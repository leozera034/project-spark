import { createHash, randomBytes } from 'node:crypto'

const SUPABASE_URL = 'https://ypgteuxzgqmkkkpvibhi.supabase.co'
const PUBLISHABLE_KEY = 'sb_publishable_r2VeXySDe1VMkFkeubZ7ww_usGb6kSG'
const EDGE_URL = `${SUPABASE_URL}/functions/v1/pediu-backend-api`
const SITE_URL = 'https://shark-cardapio.lovable.app'

const run = String(process.env.GITHUB_RUN_ID || Date.now()).slice(-12)
const suffix = `${run}-${randomBytes(2).toString('hex')}`
const passwordA = `E2E!Aa9-${suffix}-x`
const passwordB = `E2E!Bb9-${suffix}-y`
const courierPassword2 = `E2E!Cc9-${suffix}-z`

const storeAInput = {
  storeName: `E2E Loja A ${suffix}`,
  slug: `e2e-a-${suffix}`,
  segment: 'restaurante',
  city: 'Limeira do Oeste',
  state: 'MG',
  phone: '34999999999',
  ownerName: 'E2E Owner A',
  email: `e2e.a.${suffix}@example.com`,
  password: passwordA,
  planCode: 'essencial',
}
const storeBInput = {
  storeName: `E2E Loja B ${suffix}`,
  slug: `e2e-b-${suffix}`,
  segment: 'restaurante',
  city: 'Limeira do Oeste',
  state: 'MG',
  phone: '34988888888',
  ownerName: 'E2E Owner B',
  email: `e2e.b.${suffix}@example.com`,
  password: passwordB,
  planCode: 'essencial',
}

function fail(message, context) {
  console.error(`\n[E2E FAIL] ${message}`)
  if (context !== undefined) console.error(JSON.stringify(context, null, 2))
  process.exit(1)
}

function ok(message, context) {
  console.log(`[E2E PASS] ${message}${context ? ` :: ${context}` : ''}`)
}

async function jsonRequest(url, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'follow',
  })
  const text = await response.text()
  let payload = null
  try { payload = text ? JSON.parse(text) : null } catch { payload = text }
  return { response, payload }
}

async function edge(payload, accessToken) {
  const headers = { 'content-type': 'application/json', apikey: PUBLISHABLE_KEY }
  if (accessToken) headers.authorization = `Bearer ${accessToken}`
  return jsonRequest(EDGE_URL, { method: 'POST', headers, body: payload })
}

async function edgeOk(payload, accessToken) {
  const result = await edge(payload, accessToken)
  if (!result.response.ok || result.payload?.ok !== true) {
    fail(`Edge action failed (${result.response.status})`, result.payload)
  }
  return result.payload.data
}

async function signIn(email, password) {
  const result = await jsonRequest(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: PUBLISHABLE_KEY },
    body: { email, password },
  })
  if (!result.response.ok || !result.payload?.access_token) fail(`Auth login failed for ${email}`, result.payload)
  return result.payload
}

async function updatePassword(accessToken, password) {
  const result = await jsonRequest(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      apikey: PUBLISHABLE_KEY,
      authorization: `Bearer ${accessToken}`,
    },
    body: { password },
  })
  if (!result.response.ok) fail('Courier password update failed', result.payload)
}

async function rpc(name, args, accessToken) {
  return jsonRequest(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: PUBLISHABLE_KEY,
      authorization: `Bearer ${accessToken}`,
    },
    body: args ?? {},
  })
}

async function rpcOk(name, args, accessToken) {
  const result = await rpc(name, args, accessToken)
  if (!result.response.ok) fail(`RPC ${name} failed (${result.response.status})`, result.payload)
  return result.payload
}

async function assertRpcForbidden(name, args, accessToken) {
  const result = await rpc(name, args, accessToken)
  if (result.response.ok) fail(`Cross-tenant RPC ${name} unexpectedly succeeded`, result.payload)
  ok(`cross-tenant ${name} denied`, String(result.response.status))
}

async function createStore(input) {
  return edgeOk({ action: 'create_store_account', input })
}

async function publicRpc(name, args = {}) {
  return edgeOk({ action: 'rpc', rpc: name, args })
}

async function orderDetail(storeId, orderId, token) {
  return rpcOk('get_my_store_order_detail', { _store_id: storeId, _order_id: orderId }, token)
}

async function transition(name, storeId, orderId, token) {
  const before = await orderDetail(storeId, orderId, token)
  await rpcOk(name, {
    _store_id: storeId,
    _order_id: orderId,
    _expected_version: before.version,
    _internal_note: 'foundation e2e',
  }, token)
  return orderDetail(storeId, orderId, token)
}

async function createPublicOrder(slug, body) {
  const result = await jsonRequest(`${SITE_URL}/api/public/storefront/${encodeURIComponent(slug)}/pedidos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: SITE_URL },
    body,
  })
  if (!result.response.ok || result.payload?.ok !== true) {
    fail(`Public order endpoint failed (${result.response.status})`, result.payload)
  }
  return result.payload.order
}

async function courierSyntheticEmail(identifier) {
  const digest = createHash('sha256').update(`pediu-aqui:courier:${identifier}`).digest('hex')
  return `${digest.slice(0, 32)}@courier.pediuaqui.internal`
}

async function runE2E() {
  const createdA = await createStore(storeAInput)
  const createdB = await createStore(storeBInput)
  ok('two disposable tenants created', `${createdA.storeId} / ${createdB.storeId}`)

  const authA = await signIn(storeAInput.email, passwordA)
  const authB = await signIn(storeBInput.email, passwordB)
  const tokenA = authA.access_token
  const tokenB = authB.access_token
  ok('owner Auth login on external Supabase')

  const ctxA = await rpcOk('get_my_auth_context', {}, tokenA)
  const ctxB = await rpcOk('get_my_auth_context', {}, tokenB)
  if (ctxA?.account_environment !== 'store' || ctxB?.account_environment !== 'store') {
    fail('Owner auth context is not store-scoped', { ctxA, ctxB })
  }
  ok('owner auth context is tenant-scoped')

  await assertRpcForbidden('get_my_store_configuration', { _store_id: createdB.storeId }, tokenA)
  await assertRpcForbidden('create_catalog_category', {
    _store_id: createdB.storeId,
    _name: 'Cross Tenant Must Fail',
    _description: null,
    _is_active: true,
  }, tokenA)

  const category = await rpcOk('create_catalog_category', {
    _store_id: createdA.storeId,
    _name: 'E2E Categoria',
    _description: 'Categoria criada pelo teste de fundação',
    _is_active: true,
  }, tokenA)
  if (!category?.id) fail('Category RPC returned no id', category)

  const product = await rpcOk('create_simple_product', {
    _store_id: createdA.storeId,
    _category_id: category.id,
    _name: 'Produto E2E',
    _description: 'Produto descartável',
    _base_price: 19.9,
    _allows_notes: true,
    _is_active: true,
    _is_featured: true,
    _is_sold_out: false,
  }, tokenA)
  if (!product?.id) fail('Product RPC returned no id', product)
  ok('catalog write through authenticated tenant RPC', product.id)

  const page = await fetch(`${SITE_URL}/loja/${createdA.slug}`, { redirect: 'follow' })
  if (!page.ok) fail(`Public storefront page failed (${page.status})`)
  ok('public storefront route responds', String(page.status))

  const catalog = await publicRpc('storefront_catalog', { _slug: createdA.slug })
  const catalogText = JSON.stringify(catalog)
  if (!catalogText.includes(product.id) || !catalogText.includes('Produto E2E')) {
    fail('Public catalog does not expose the created product', catalog)
  }
  ok('public catalog reads created product')

  const pickupMethods = await publicRpc('storefront_payment_methods', {
    _slug: createdA.slug,
    _fulfillment_type: 'retirada',
  })
  const pickupMethod = pickupMethods?.methods?.find((m) => m.kind === 'pix') ?? pickupMethods?.methods?.[0]
  if (!pickupMethod?.id) fail('No pickup payment method available', pickupMethods)

  const pickupOrder = await createPublicOrder(createdA.slug, {
    idempotencyKey: `e2e-pickup-${suffix}`,
    customer: { firstName: 'Cliente E2E', phone: '34999999999' },
    fulfillment: { type: 'retirada' },
    address: null,
    payment: { methodId: pickupMethod.id, changeFor: null },
    notes: 'Pedido pickup E2E',
    lines: [{
      lineId: 'pickup-line-1',
      product_id: product.id,
      variant_id: null,
      quantity: 1,
      notes: null,
      selections: [],
    }],
  })
  ok('public pickup order created', pickupOrder.id)

  await transition('accept_store_order', createdA.storeId, pickupOrder.id, tokenA)
  await transition('start_store_order_preparation', createdA.storeId, pickupOrder.id, tokenA)
  await transition('mark_store_order_ready', createdA.storeId, pickupOrder.id, tokenA)
  const pickupReady = await orderDetail(createdA.storeId, pickupOrder.id, tokenA)
  await rpcOk('complete_store_pickup_order', {
    _store_id: createdA.storeId,
    _order_id: pickupOrder.id,
    _expected_version: pickupReady.version,
    _internal_note: 'foundation e2e pickup complete',
  }, tokenA)
  const pickupFinal = await orderDetail(createdA.storeId, pickupOrder.id, tokenA)
  if (pickupFinal.status !== 'retirado') fail('Pickup order did not reach retirado', pickupFinal)
  ok('store order lifecycle pickup completed')

  const courierIdentifier = `e2ec.${suffix.replace(/-/g, '').slice(0, 16)}`
  const courierCreated = await edgeOk({
    action: 'create_courier',
    input: {
      fullName: 'Entregador E2E',
      phone: '34977777777',
      loginIdentifier: courierIdentifier,
      canAcceptDeliveries: true,
      isActive: true,
      idempotencyKey: `e2e-courier-${suffix}`,
    },
  }, tokenA)
  if (!courierCreated?.courierId || !courierCreated?.temporaryPassword) fail('Courier creation failed', courierCreated)
  ok('courier provisioned by tenant owner', courierCreated.courierId)

  const forbiddenReset = await edge({
    action: 'reset_courier_access',
    input: { courier_id: courierCreated.courierId },
  }, tokenB)
  if (forbiddenReset.response.status !== 403) fail('Tenant B could reset tenant A courier', forbiddenReset.payload)
  ok('cross-tenant courier admin denied', '403')

  const courierEmail = await courierSyntheticEmail(courierIdentifier)
  const courierAuth = await signIn(courierEmail, courierCreated.temporaryPassword)
  let courierToken = courierAuth.access_token
  const courierCtx = await rpcOk('get_my_auth_context', {}, courierToken)
  if (courierCtx?.account_environment !== 'courier') fail('Courier auth context invalid', courierCtx)
  ok('courier login with deterministic synthetic identity')

  await updatePassword(courierToken, courierPassword2)
  await rpcOk('complete_my_initial_password_change', {}, courierToken)
  const courierRelogin = await signIn(courierEmail, courierPassword2)
  courierToken = courierRelogin.access_token
  await rpcOk('set_my_courier_online', {}, courierToken)
  ok('courier initial password rotation + online presence')

  await rpcOk('upsert_store_neighborhood', {
    _store_id: createdA.storeId,
    _id: null,
    _name: 'Centro E2E',
    _delivery_fee: 5,
    _min_order_amount: 0,
    _eta_minutes: 30,
    _notes: 'Área descartável E2E',
    _is_active: true,
  }, tokenA)

  const fulfillment = await publicRpc('storefront_fulfillment', { _slug: createdA.slug })
  const area = fulfillment?.deliveryAreas?.find((item) => item.name === 'Centro E2E') ?? fulfillment?.deliveryAreas?.[0]
  if (!area?.id || !fulfillment?.configurationVersion) fail('Delivery configuration unavailable', fulfillment)

  const deliveryMethods = await publicRpc('storefront_payment_methods', {
    _slug: createdA.slug,
    _fulfillment_type: 'entrega',
  })
  const deliveryMethod = deliveryMethods?.methods?.find((m) => m.kind === 'pix') ?? deliveryMethods?.methods?.[0]
  if (!deliveryMethod?.id) fail('No delivery payment method available', deliveryMethods)

  const deliveryOrder = await createPublicOrder(createdA.slug, {
    idempotencyKey: `e2e-delivery-${suffix}`,
    customer: { firstName: 'Cliente Entrega', phone: '34966666666' },
    fulfillment: {
      type: 'entrega',
      deliveryAreaId: area.id,
      configurationVersion: fulfillment.configurationVersion,
    },
    address: {
      street: 'Rua Teste E2E',
      number: '123',
      hasNoNumber: false,
      complement: null,
      reference: 'Teste automatizado',
      label: 'Casa',
    },
    payment: { methodId: deliveryMethod.id, changeFor: null },
    notes: 'Pedido entrega E2E',
    lines: [{
      lineId: 'delivery-line-1',
      product_id: product.id,
      variant_id: null,
      quantity: 1,
      notes: null,
      selections: [],
    }],
  })
  ok('public delivery order created', deliveryOrder.id)

  await transition('accept_store_order', createdA.storeId, deliveryOrder.id, tokenA)
  await transition('start_store_order_preparation', createdA.storeId, deliveryOrder.id, tokenA)
  await transition('mark_store_order_ready', createdA.storeId, deliveryOrder.id, tokenA)

  const eligible = await rpcOk('list_eligible_couriers_for_delivery', {
    _store_id: createdA.storeId,
    _order_id: deliveryOrder.id,
  }, tokenA)
  const courierEntry = eligible?.couriers?.find((c) => c.courierId === courierCreated.courierId)
  if (!courierEntry || courierEntry.eligibility === 'blocked') fail('Courier not eligible for delivery', eligible)

  const assigned = await rpcOk('assign_delivery_courier', {
    _store_id: createdA.storeId,
    _order_id: deliveryOrder.id,
    _courier_id: courierCreated.courierId,
    _expected_delivery_version: 1,
    _internal_note: 'foundation e2e assign',
  }, tokenA)
  const delivery = assigned?.delivery
  if (!delivery?.deliveryId || !Number.isInteger(delivery.version)) fail('Delivery assignment returned no delivery', assigned)
  ok('owner assigned delivery to courier', delivery.deliveryId)

  let courierStep = await rpcOk('confirm_my_arrival_at_store', {
    _delivery_id: delivery.deliveryId,
    _expected_version: delivery.version,
    _idempotency_key: `e2e-arrival-${suffix}`,
  }, courierToken)
  courierStep = await rpcOk('confirm_my_order_pickup', {
    _delivery_id: delivery.deliveryId,
    _expected_version: courierStep.version,
    _idempotency_key: `e2e-pickup-courier-${suffix}`,
  }, courierToken)
  courierStep = await rpcOk('start_my_delivery', {
    _delivery_id: delivery.deliveryId,
    _expected_version: courierStep.version,
    _idempotency_key: `e2e-start-delivery-${suffix}`,
  }, courierToken)
  courierStep = await rpcOk('complete_my_delivery', {
    _delivery_id: delivery.deliveryId,
    _expected_version: courierStep.version,
    _idempotency_key: `e2e-complete-delivery-${suffix}`,
  }, courierToken)
  if (courierStep.status !== 'concluida') fail('Courier delivery did not complete', courierStep)

  const deliveryFinal = await orderDetail(createdA.storeId, deliveryOrder.id, tokenA)
  if (deliveryFinal.status !== 'entregue') fail('Delivery order did not reach entregue', deliveryFinal)
  ok('courier delivery lifecycle completed end-to-end')

  const tokenHash = createHash('sha256').update(deliveryOrder.trackingToken).digest('hex')
  const tracking = await publicRpc('storefront_order_tracking', {
    _token_hash: tokenHash,
    _known_version: null,
  })
  if (tracking?.ok !== true || tracking?.status !== 'entregue') fail('Public tracking did not reflect delivered order', tracking)
  ok('public order tracking reflects final delivered status')

  console.log('\nFOUNDATION_E2E_RESULT=' + JSON.stringify({
    suffix,
    storeAId: createdA.storeId,
    storeBId: createdB.storeId,
    ownerAEmail: storeAInput.email,
    ownerBEmail: storeBInput.email,
    courierId: courierCreated.courierId,
    courierEmail,
    pickupOrderId: pickupOrder.id,
    deliveryOrderId: deliveryOrder.id,
    deliveryId: delivery.deliveryId,
  }))
}

runE2E().catch((error) => fail('Unhandled E2E error', { message: error?.message, stack: error?.stack }))
