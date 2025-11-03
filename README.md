# Backend - Sistema de Envio de Currículos

Backend para o sistema de envio de currículos, construído com Node.js, Express e Supabase.

## Funcionalidades

- ✅ Recebimento de currículos via formulário web
- ✅ Upload de arquivos (PDF, Word)
- ✅ Verificação de duplicidade (CPF por vaga)
- ✅ Armazenamento no Supabase (dados + arquivos)
- ✅ Rate limiting e segurança básica
- ✅ API RESTful

## Configuração

### Pré-requisitos

- Node.js 16+
- Conta no Supabase
- Conta no Render (para deploy)

### Variáveis de Ambiente

Crie um arquivo `.env` com:

```env
SUPABASE_URL=sua_url_do_supabase
SUPABASE_SERVICE_KEY=sua_service_key_do_supabase
PORT=3000
