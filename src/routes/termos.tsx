import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/termos")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Termos de Uso | Comandiva" },
      {
        name: "description",
        content: "Condições gerais de uso da plataforma Comandiva.",
      },
    ],
  }),
});

function TermsPage() {
  return (
    <LegalPage title="Termos de Uso" updatedAt="22 de agosto de 2026">
      <section>
        <h2>1. Objeto</h2>
        <p>
          A Comandiva disponibiliza uma plataforma tecnológica para criação e operação de cardápios digitais, recebimento e gestão de pedidos, cozinha, entrega própria, comunicação, assinaturas, pagamentos e recursos complementares contratados pela loja.
        </p>
        <p>
          A Comandiva não é o estabelecimento que vende alimentos ou produtos ao consumidor final e, salvo indicação expressa em fluxo específico, não substitui o lojista na relação de consumo referente ao pedido, qualidade dos itens, disponibilidade, preparo, entrega e obrigações próprias do estabelecimento.
        </p>
      </section>

      <section>
        <h2>2. Cadastro, conta e segurança</h2>
        <p>
          O usuário deve fornecer informações verdadeiras, manter seus dados atualizados e proteger credenciais de acesso. Contas, funções e permissões devem ser atribuídas apenas a pessoas autorizadas pela organização responsável pela loja.
        </p>
        <p>
          Atividades realizadas por uma sessão autenticada poderão ser registradas para fins de segurança e auditoria. Suspeitas de comprometimento devem ser comunicadas imediatamente pelo canal oficial de suporte.
        </p>
      </section>

      <section>
        <h2>3. Responsabilidades do lojista</h2>
        <ul>
          <li>manter cardápio, preços, disponibilidade, horários, taxas e informações comerciais corretos;</li>
          <li>cumprir obrigações sanitárias, fiscais, consumeristas, trabalhistas e regulatórias aplicáveis ao próprio negócio;</li>
          <li>atender pedidos e consumidores de forma compatível com as ofertas publicadas;</li>
          <li>gerenciar adequadamente usuários internos, entregadores e permissões;</li>
          <li>utilizar dados de consumidores e ferramentas de comunicação somente com fundamento legal e finalidade legítima;</li>
          <li>não usar a plataforma para fraude, spam, conteúdo ilícito, engenharia reversa abusiva ou violação de direitos de terceiros.</li>
        </ul>
      </section>

      <section>
        <h2>4. Planos, adicionais e cobrança</h2>
        <p>
          Recursos disponíveis podem variar conforme o plano e módulos adicionais contratados. Preço, periodicidade, período de teste, limites, taxas e condições comerciais aplicáveis serão apresentados antes da contratação e poderão ser registrados na conta da loja.
        </p>
        <p>
          Serviços pagos podem ser processados por provedores de pagamento integrados. A Comandiva não deve armazenar dados completos de cartão quando a coleta é realizada diretamente pela infraestrutura do provedor de pagamento.
        </p>
      </section>

      <section>
        <h2>5. Pagamentos de pedidos e repasses</h2>
        <p>
          Quando a loja habilitar pagamentos online e repasses, a disponibilidade do recurso depende da conclusão do cadastro exigido pelo provedor, da validação de identidade ou empresa e do atendimento aos requisitos de risco e compliance aplicáveis.
        </p>
        <p>
          Valores líquidos, tarifas, prazos de liberação, estornos, disputas e demais condições devem ser apresentados na interface financeira e podem depender do método de pagamento e da infraestrutura do provedor. Nenhum valor é considerado definitivamente disponível antes da confirmação operacional correspondente.
        </p>
      </section>

      <section>
        <h2>6. Integrações de terceiros</h2>
        <p>
          A plataforma pode integrar serviços de pagamento, WhatsApp, e-mail, mapas, hospedagem, banco de dados, observabilidade e outros fornecedores. A disponibilidade de uma integração pode depender de conta externa, credenciais, aprovação, limites, políticas e disponibilidade do respectivo fornecedor.
        </p>
        <p>
          A Comandiva poderá suspender uma integração específica quando houver risco de segurança, uso abusivo, indisponibilidade do fornecedor ou descumprimento de requisitos necessários à operação segura.
        </p>
      </section>

      <section>
        <h2>7. Comunicações e automações</h2>
        <p>
          Mensagens automáticas devem ser configuradas e utilizadas de acordo com a finalidade do pedido, preferências do destinatário e regras aplicáveis ao canal utilizado. O lojista é responsável pelo conteúdo comercial que decidir enviar e por manter as bases legais e consentimentos exigíveis para ações de marketing.
        </p>
      </section>

      <section>
        <h2>8. Disponibilidade, manutenção e alterações</h2>
        <p>
          A Comandiva busca manter o serviço disponível e seguro, mas não garante funcionamento ininterrupto. Manutenções, incidentes, mudanças de fornecedores, atualizações de segurança e eventos fora do controle razoável podem causar indisponibilidade temporária.
        </p>
        <p>
          Funcionalidades podem evoluir, ser substituídas ou descontinuadas quando necessário, preservando-se as obrigações contratuais e comunicações aplicáveis aos clientes afetados.
        </p>
      </section>

      <section>
        <h2>9. Propriedade intelectual</h2>
        <p>
          O software, marca, interfaces, documentação e demais elementos próprios da Comandiva permanecem protegidos pela legislação aplicável. A contratação concede direito limitado de uso do serviço durante a vigência, sem transferência de titularidade do software.
        </p>
        <p>
          O lojista mantém a titularidade e responsabilidade pelos conteúdos, marcas, imagens e materiais que inserir na plataforma e declara possuir autorização para utilizá-los.
        </p>
      </section>

      <section>
        <h2>10. Suspensão e encerramento</h2>
        <p>
          Contas ou funcionalidades podem ser suspensas em caso de fraude, risco relevante de segurança, uso ilícito, inadimplência quando contratualmente aplicável ou violação material destes Termos. Sempre que compatível com a gravidade e a segurança do caso, será disponibilizado meio de regularização ou suporte.
        </p>
      </section>

      <section>
        <h2>11. Limitação e apuração de responsabilidade</h2>
        <p>
          A responsabilidade de cada parte deve ser analisada conforme sua atuação efetiva, a legislação aplicável e o instrumento comercial contratado. Estes Termos não excluem direitos que não possam ser legalmente afastados, nem limitam responsabilidade em hipóteses em que a lei não permita limitação.
        </p>
      </section>

      <section>
        <h2>12. Privacidade e proteção de dados</h2>
        <p>
          O tratamento de dados pessoais relacionado à plataforma é descrito na Política de Privacidade da Comandiva. Lojistas que tratem dados de seus próprios consumidores continuam responsáveis pelas obrigações que lhes caibam como agentes de tratamento.
        </p>
      </section>

      <section>
        <h2>13. Identificação do fornecedor e condições comerciais</h2>
        <p>
          A razão social, CNPJ, endereço de contato e demais dados societários do fornecedor responsável pela Comandiva devem constar no instrumento de contratação e nesta página antes do lançamento comercial definitivo. Condições específicas de preço, vigência, cancelamento e suporte apresentadas na contratação integram estes Termos quando aplicáveis.
        </p>
      </section>

      <section>
        <h2>14. Alterações e legislação aplicável</h2>
        <p>
          Estes Termos podem ser atualizados por razões legais, técnicas ou comerciais. Alterações materiais que afetem contratos em vigor serão comunicadas pelos meios adequados. A relação é regida pela legislação brasileira, respeitadas as regras de competência e proteção obrigatória aplicáveis a cada caso.
        </p>
      </section>
    </LegalPage>
  );
}
