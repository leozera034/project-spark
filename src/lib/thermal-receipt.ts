import type { StoreOrderDetail } from "@/store-orders/types";

/**
 * Impressão de cupom em impressora térmica (80mm).
 *
 * Estratégia de produção sem dependência nativa: gera um documento HTML com
 * largura de 80mm e dispara a impressão pelo driver do sistema (o mesmo
 * caminho usado por impressoras térmicas USB/rede em balcão). Não usa
 * bibliotecas nativas nem ESC/POS binário, portanto funciona no navegador
 * do PDV sem instalação adicional.
 */

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatAddress(address: Record<string, unknown> | null | undefined): string | null {
  if (!address) return null;
  const parts = ["street", "number", "complement", "reference", "neighborhood"]
    .map((key) => address[key])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return parts.length > 0 ? parts.join(", ") : null;
}

export interface ReceiptStoreInfo {
  name: string;
  phone?: string | null;
  city?: string | null;
}

export function buildReceiptHtml(order: StoreOrderDetail, store: ReceiptStoreInfo): string {
  const createdAt = new Date(order.createdAt).toLocaleString("pt-BR");
  const address = formatAddress(order.delivery?.address ?? null);

  const items = order.items
    .map((item) => {
      const options =
        item.options.length > 0
          ? `<div class="sub">${escapeHtml(
              item.options
                .map((option) =>
                  option.quantity > 1
                    ? `${option.quantity}× ${option.optionName}`
                    : option.optionName,
                )
                .join(", "),
            )}</div>`
          : "";
      const notes = item.notes ? `<div class="sub">Obs: ${escapeHtml(item.notes)}</div>` : "";
      return `<div class="item">
        <div class="row"><span>${item.quantity}× ${escapeHtml(item.productName)}${
          item.variantName ? ` (${escapeHtml(item.variantName)})` : ""
        }</span><span>${brl(item.lineTotal)}</span></div>
        ${options}${notes}
      </div>`;
    })
    .join("");

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>Pedido #${order.orderNumber}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: 80mm; margin: 0; padding: 4mm; font-family: "Courier New", ui-monospace, monospace;
         font-size: 12px; line-height: 1.35; color: #000; background: #fff; }
  h1 { font-size: 15px; margin: 0 0 2px; text-align: center; text-transform: uppercase; }
  .center { text-align: center; }
  .muted { font-size: 11px; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 6px; }
  .sub { font-size: 11px; padding-left: 10px; }
  .item { margin-bottom: 4px; }
  .total { font-size: 14px; font-weight: bold; }
  .big { font-size: 18px; font-weight: bold; text-align: center; }
</style></head>
<body>
  <h1>${escapeHtml(store.name)}</h1>
  <div class="center muted">${escapeHtml(store.city ?? "")}${
    store.phone ? ` · ${escapeHtml(store.phone)}` : ""
  }</div>
  <hr />
  <div class="big">PEDIDO #${order.orderNumber}</div>
  <div class="center muted">${escapeHtml(order.publicCode)} · ${createdAt}</div>
  <div class="center">${order.fulfillment === "entrega" ? "ENTREGA" : "RETIRADA"}</div>
  <hr />
  <div><strong>${escapeHtml(order.customer.fullName ?? order.customer.firstName)}</strong></div>
  ${order.customer.phone ? `<div class="muted">${escapeHtml(order.customer.phone)}</div>` : ""}
  ${
    order.fulfillment === "entrega"
      ? `${order.delivery?.neighborhood ? `<div class="muted">Bairro: ${escapeHtml(order.delivery.neighborhood)}</div>` : ""}
         ${address ? `<div class="muted">${escapeHtml(address)}</div>` : ""}`
      : ""
  }
  <hr />
  ${items}
  <hr />
  <div class="row"><span>Subtotal</span><span>${brl(order.totals.subtotal)}</span></div>
  ${
    order.totals.deliveryFee
      ? `<div class="row"><span>Taxa de entrega</span><span>${brl(order.totals.deliveryFee)}</span></div>`
      : ""
  }
  ${
    order.totals.discount
      ? `<div class="row"><span>Desconto</span><span>-${brl(order.totals.discount)}</span></div>`
      : ""
  }
  <div class="row total"><span>TOTAL</span><span>${brl(order.totals.total)}</span></div>
  <hr />
  <div>${escapeHtml(order.payment.label ?? "Pagamento")}</div>
  ${
    order.payment.needsChange && order.payment.changeFor
      ? `<div>Troco para ${brl(order.payment.changeFor)}</div>`
      : ""
  }
  ${order.notes ? `<hr /><div class="muted">Obs: ${escapeHtml(order.notes)}</div>` : ""}
  <hr />
  <div class="center muted">Pediu Aqui · pedido registrado às ${new Date(
    order.createdAt,
  ).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
  <div style="height:8mm"></div>
</body></html>`;
}

/**
 * Abre o diálogo de impressão do sistema com o cupom já formatado em 80mm.
 * Usa um iframe isolado para não interferir na página do painel.
 */
export function printOrderReceipt(order: StoreOrderDetail, store: ReceiptStoreInfo): void {
  if (typeof document === "undefined") return;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(buildReceiptHtml(order, store));
  doc.close();

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 1000);
  };

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      cleanup();
    }
  };
}
