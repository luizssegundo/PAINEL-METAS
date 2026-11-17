-- Código da loja no XMenu Data API (storeId / partnerId). Quando preenchido, a unidade pode
-- puxar as vendas direto da API (botão "Puxar do Xmenu" e rotina diária). Vazio = só importação manual.
alter table public.units add column if not exists xmenu_store_id text;
create unique index if not exists units_xmenu_store_id_key on public.units (xmenu_store_id) where xmenu_store_id is not null;
