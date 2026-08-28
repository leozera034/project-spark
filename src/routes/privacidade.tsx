import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/privacidade")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade | Comandiva" },
      {
        name: "description",
        content: "Como a Comandiva trata dados pessoais de lojistas, equipes, entregadores e clientes.",
      },
    ],
  }),
});

function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade" updatedAt="22 de agosto de 2026">
      <section>
        <h2>1. Escopo e papéis no tratamento</h2>
        <p>
          Esta Política explica como a Comandiva trata dados pessoais ao disponibilizar sua plataforma de cardápio digital, pedidos, gestão de loja, entrega, comunicação, cobrança e recursos relacionados.
        </p>
        <p>
          Dependendo do fluxo, a Comandiva pode atuar como controladora dos dados necessários à conta, contratação, segurança, suporte e operação da própria plataforma, ou como operadora quando trata dados de clientes finais em nome do lojista. O lojista continua responsável por definir finalidades e bases legais dos tratamentos que realiza em seu próprio negócio.
        </p>
      </section>

      <section>
        <h2>2. Dados que podem ser tratados</h2>
        <ul>
          <li>dados cadastrais e de contato, como nome, e-mail, telefone e dados da empresa;</li>
          <li>dados de autenticação, perfis de acesso, permissões e registros de segurança;</li>
          <li>dados de pedidos, endereços de entrega, itens, valores, status e histórico operacional;</li>
          <li>dados de entregadores necessários à atribuição e execução de entregas;</li>
          <li>dados de cobrança, assinatura e referências de transações processadas por provedores de pagamento;</li>
          <li>mensagens, tickets e registros enviados aos canais de suporte e comunicação;</li>
          <li>dados técnicos, como IP, navegador, dispositivo, logs, identificadores e eventos de uso;</li>
          <li>preferências de comunicação e consentimentos quando aplicáveis.</li>
        </ul>
      </section>

      <section>
        <h2>3. Finalidades</h2>
        <p>Os dados podem ser utilizados para:</p>
        <ul>
          <li>criar e administrar contas, lojas, equipes e permissões;</li>
          <li>receber, processar e acompanhar pedidos e entregas;</li>
          <li>executar cobranças, assinaturas, repasses e conciliações;</li>
          <li>enviar comunicações transacionais solicitadas ou necessárias à operação;</li>
          <li>prevenir fraude, abuso, incidentes e acesso não autorizado;</li>
          <li>prestar suporte, investigar erros e manter evidências de auditoria;</li>
          <li>medir desempenho do produto e, quando permitido, resultados de aquisição e marketing;</li>
          <li>cumprir obrigações legais, regulatórias e exercer direitos em processos.</li>
        </ul>
      </section>

      <section>
        <h2>4. Bases legais</h2>
        <p>
          O tratamento é realizado conforme a finalidade e o contexto, podendo se apoiar, entre outras hipóteses previstas na LGPD, na execução de contrato e procedimentos preliminares, cumprimento de obrigação legal ou regulatória, exercício regular de direitos, legítimo interesse após avaliação adequada e consentimento quando ele for a base aplicável.
        </p>
        <p>
          A Comandiva não presume que todo tratamento dependa de consentimento. Quando o consentimento for utilizado, ele deverá ser livre, informado, inequívoco e passível de revogação pelos meios disponibilizados.
        </p>
      </section>

      <section>
        <h2>5. Compartilhamento e fornecedores</h2>
        <p>
          Dados podem ser compartilhados somente na medida necessária com fornecedores de infraestrutura, banco de dados, hospedagem, observabilidade, e-mail, comunicação, pagamentos, prevenção a fraude e outros subprocessadores necessários à prestação do serviço. Entre as integrações que podem ser ativadas estão serviços como Supabase, Stripe, provedores de WhatsApp e infraestrutura de hospedagem.
        </p>
        <p>
          Cada integração é sujeita às próprias condições e práticas de privacidade do fornecedor. A Comandiva busca limitar o compartilhamento ao necessário para a finalidade contratada.
        </p>
      </section>

      <section>
        <h2>6. Cookies, analytics e publicidade</h2>
        <p>
          Cookies ou tecnologias estritamente necessários podem ser usados para autenticação, segurança e funcionamento do site. Recursos de analytics ou publicidade que não sejam estritamente necessários somente devem ser ativados de acordo com a configuração aplicável e as escolhas de privacidade disponibilizadas ao visitante.
        </p>
        <p>
          Quando ferramentas de mensuração ou publicidade forem habilitadas, a Comandiva poderá registrar eventos como visualização de página, início de cadastro, criação de loja e conversões, evitando enviar deliberadamente conteúdo de pedidos ou outros dados pessoais desnecessários aos provedores de mídia.
        </p>
      </section>

      <section>
        <h2>7. Retenção e eliminação</h2>
        <p>
          Os dados são mantidos pelo período necessário à prestação do serviço, cumprimento de obrigações legais e regulatórias, prevenção a fraude, resolução de disputas, auditoria e exercício de direitos. Encerrada a finalidade e inexistindo obrigação ou fundamento para retenção, os dados são eliminados, anonimizados ou mantidos de forma restrita conforme aplicável.
        </p>
      </section>

      <section>
        <h2>8. Segurança</h2>
        <p>
          A plataforma utiliza controles técnicos e organizacionais destinados a reduzir riscos de acesso indevido, alteração, perda e divulgação não autorizada, incluindo controle de acesso, segregação entre lojas, registros de auditoria e proteção de credenciais. Nenhum sistema conectado à internet oferece risco zero, por isso os controles são revisados continuamente.
        </p>
      </section>

      <section>
        <h2>9. Transferências internacionais</h2>
        <p>
          Alguns fornecedores de tecnologia podem processar ou armazenar dados fora do Brasil. Quando isso ocorrer, a transferência deverá observar os requisitos aplicáveis da LGPD e as salvaguardas disponíveis para o serviço contratado.
        </p>
      </section>

      <section>
        <h2>10. Direitos dos titulares</h2>
        <p>
          Nos termos da LGPD, o titular pode exercer, quando aplicável, direitos relacionados à confirmação e acesso ao tratamento, correção, anonimização, bloqueio ou eliminação, portabilidade nos limites regulamentares, informações sobre compartilhamento, oposição, revogação de consentimento e revisão de decisões automatizadas.
        </p>
        <p>
          Solicitações devem ser encaminhadas pelo canal oficial de suporte da Comandiva. Para proteger o próprio titular, poderá ser necessária verificação de identidade e de legitimidade do pedido.
        </p>
      </section>

      <section>
        <h2>11. Dados tratados em nome das lojas</h2>
        <p>
          Pedidos e cadastros de consumidores inseridos ou coletados para uma loja podem ser tratados pela Comandiva como operadora, conforme instruções e configurações do lojista. Nesses casos, pedidos de titulares relacionados à finalidade comercial da loja podem precisar ser direcionados ao próprio estabelecimento, sem prejuízo do suporte técnico prestado pela Comandiva.
        </p>
      </section>

      <section>
        <h2>12. Identificação e contato</h2>
        <p>
          A identificação societária completa do responsável pela operação da Comandiva, bem como o canal específico para assuntos de privacidade e do encarregado quando aplicável, deve constar no instrumento de contratação e nesta página antes do lançamento comercial definitivo. Até essa complementação, solicitações podem ser abertas pelo canal oficial de suporte disponibilizado na plataforma.
        </p>
      </section>

      <section>
        <h2>13. Alterações desta Política</h2>
        <p>
          Esta Política pode ser atualizada para refletir mudanças legais, operacionais ou de produto. Alterações materiais serão comunicadas pelos meios adequados, e a data da última atualização permanecerá indicada no topo desta página.
        </p>
      </section>
    </LegalPage>
  );
}
