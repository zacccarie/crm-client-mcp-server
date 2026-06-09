# crm-client-mcp-server

Serveur MCP **client** : pilotez **votre** CRM depuis l'assistant IA de votre choix (Claude Desktop, etc.).
Authentification par **clé MCP** (générée dans le CRM → Aide → « Clé MCP / IA »). La clé est liée à votre
espace : vous n'accédez **qu'à vos propres données**.

## Setup
```bash
npm install && npm run build
cp .env.example .env     # renseigner CRM_BASE_URL + MCP_KEY (mcp_...)
```

## Brancher sur Claude Desktop
```bash
claude mcp add mon-crm -- node /chemin/vers/crm-client-mcp-server/dist/index.js
```
(la config — URL + clé — est lue depuis `.env`).

## Outils
- `crm_list` — lister vos clients / prospects / leads / chantiers / factures / rendez-vous.
- `crm_create_client`, `crm_create_prospect`, `crm_create_lead`, `crm_create_appointment` — créer.
- `crm_update_prospect_stage` — déplacer un prospect dans le pipeline.

Exemples : « liste mes prospects à rappeler », « crée un client Jean Dupont à Lyon », « planifie un RDV demain 10h pour ce client », « passe ce prospect en CONVERTED ».

## Sécurité
La clé ne donne accès qu'à votre espace (le tenant est dérivé de la clé côté serveur). Révoquez-la à tout moment dans le CRM — l'accès est coupé instantanément.
