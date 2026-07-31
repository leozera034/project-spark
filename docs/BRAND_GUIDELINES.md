# Pediu Aqui — Manual de Marca

Documento normativo da Fase 02. Toda aplicação da marca segue estas regras.
Alterações exigem registro em `docs/DECISION_LOG.md`.

---

## 1. Conceito

O símbolo é a letra **P** construída em geometria constante, atravessada por uma
**faixa horizontal** que avança para fora da letra. A faixa representa o pedido
em movimento: sai da loja e chega ao cliente.

Atributos: minimalista, tecnológico, confiável, local.
O símbolo não usa ícone de comida, moto, sacola, balão de conversa ou cursor.

## 2. Fonte única de verdade

Toda a geometria existe em um lugar só:

- `tools/brand-geometry.mjs` — geometria do símbolo, cores e composições.
- `tools/brand-text-paths.json` — o wordmark já convertido em contornos.
- `public/brand/pediu-aqui-master.svg` — SVG master gerado a partir do arquivo acima.

Todos os demais arquivos são derivados por `npm run brand:generate`.
**Nunca redesenhe o logotipo em outro arquivo, componente ou ferramenta.**

Para regerar tudo:

```bash
npm run brand:generate
```

## 3. Arquivos gerados

### Vetores (`public/brand/`)

| Arquivo | Uso |
| --- | --- |
| `pediu-aqui-master.svg` | fonte de verdade, bloco horizontal oficial |
| `pediu-aqui-symbol.svg` | símbolo isolado |
| `pediu-aqui-wordmark.svg` | grafia isolada |
| `symbol-carbon-teal.svg` | símbolo oficial em duas cores |
| `symbol-carbon.svg` / `symbol-teal.svg` / `symbol-white.svg` | símbolo em cor única |
| `logo-horizontal-carbon.svg` | fundo claro |
| `logo-horizontal-white.svg` | fundo escuro |
| `logo-horizontal-monochrome.svg` | impressão de uma cor |
| `logo-stacked-carbon.svg` / `-white.svg` / `-monochrome.svg` | bloco vertical |

### Ícones

- Favicon: `public/favicon.svg`, `public/favicon.ico`, `favicon-16/32/48/64.png`
- PWA: `pwa-icon-192x192.png`, `pwa-icon-512x512.png`, `pwa-maskable-512x512.png`
- iOS: `apple-touch-icon-180x180.png`, `ios-app-icon-1024x1024.png` (fundo sólido, sem transparência)
- Android: `android-icon-512x512.png`, `android-adaptive-foreground-432x432.png`,
  `android-adaptive-background-432x432.png`, `android-monochrome-432x432.png`

### SEO, redes e splash

- `og-image-1200x630.png`, `twitter-card-1200x600.png`
- `social-square-1080x1080.png`, `social-story-1080x1920.png`
- `splash-light-1080x1920.png`, `splash-dark-1080x1920.png`
- `splash-landscape-light-1920x1080.png`, `splash-landscape-dark-1920x1080.png`

## 4. Uso correto

- **Área de respiro:** no mínimo a largura da haste vertical do símbolo em todos os lados.
- **Tamanho mínimo:** símbolo 24px de altura; bloco horizontal 20px de altura.
- **Fundo claro:** versão carbono. **Fundo escuro:** versão branca.
- **Uma cor:** versão monocromática.
- **Fotografia:** apenas sobre área de contraste controlado, nunca sobre imagem carregada.

## 5. Uso proibido

- Distorcer, inclinar, girar, espelhar ou alterar proporções.
- Recolorir fora da paleta oficial.
- Aplicar sombra, contorno, brilho, gradiente, neon ou efeito 3D.
- Recompor o bloco alterando a distância entre símbolo e grafia.
- Usar o wordmark sozinho antes de o símbolo aparecer na mesma tela.
- Colocar o logotipo dentro de caixas decorativas ou molduras improvisadas.

## 6. Paleta

Cor de ação é sempre o teal. Carbono é a base institucional.
Proibidos: roxo, laranja, vermelho decorativo, neon e gradientes chamativos.

| Papel | Hex | Token |
| --- | --- | --- |
| Carbono 950 | `#071014` | `--background` (escuro) |
| Carbono 900 | `#0B171C` | `--carbon`, `--primary` (claro) |
| Carbono 800 | `#14252B` | `--surface-raised` (escuro) |
| Carbono 700 | `#20343A` | `--border` (escuro) |
| Teal 700 | `#008C7D` | `--brand-strong` |
| Teal 600 | `#00A896` | `--brand` |
| Teal 500 | `#00C2A8` | faixa do símbolo |
| Teal 400 | `#30D6BE` | `--brand` (escuro) |
| Teal 100 | `#DFF9F3` | `--brand-soft` |
| Fundo | `#F4F7F7` | `--background` |
| Superfície | `#FFFFFF` | `--surface` |
| Superfície suave | `#EAF0F0` | `--surface-muted` |
| Texto principal | `#101718` | `--foreground` |
| Texto secundário | `#526164` | `--muted-foreground` |
| Contorno | `#D8E1E1` | `--border` |
| Sucesso | `#12805C` | `--success` |
| Atenção | `#B87400` | `--warning` |
| Erro | `#C0392B` | `--danger` |
| Informação | `#1F6FB2` | `--info` |

Os valores vivem em `src/styles.css` no formato `oklch`.
**Componentes nunca usam cor crua** (`text-white`, `bg-black`, `bg-[#hex]`).

## 7. Tipografia

Inter em toda a plataforma, pesos 400, 500, 600, 700 e 800.
O wordmark usa Inter convertido em contornos, então não depende de fonte instalada.

| Nível | Estilo |
| --- | --- |
| Display | 36–48px, extrabold, tracking apertado |
| Título 1 | 30px, bold |
| Título 2 | 24px, semibold |
| Título 3 | 20px, semibold |
| Corpo | 16px, regular |
| Apoio | 14px, texto secundário |
| Legenda | 12px, maiúsculas, tracking largo |

## 8. Espaçamento, raio e elevação

- Escala de espaçamento em múltiplos de 4px.
- Raio base 12px (`--radius`).
- Elevação em três níveis: `shadow-e1`, `shadow-e2`, `shadow-e3`. Sombras discretas, nunca coloridas.
- Alvo de toque mínimo de 48px em fluxos de cliente e de entregador (`size="touch"`).

## 9. Componentes de marca

```tsx
import { BrandLogo, BrandSymbol, BrandWordmark } from "@/components/brand/BrandLogo";

<BrandLogo />                          // horizontal carbono
<BrandLogo lockup="stacked" tone="white" />
<BrandSymbol tone="teal" className="size-8" />
```

## 10. Galeria

A galeria viva está em `/design-system`. Ela é a referência visual oficial e
deve ser atualizada sempre que um token ou componente mudar.
