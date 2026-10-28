-- Gerentes podem enviar o relatório do mês anterior até o dia 05 do mês seguinte (horário de Brasília),
-- para fechar os resultados do mês. Vale só para os dados do relatório (faturamento, vendas por categoria
-- e por campanha); metas e itens de campanha continuam travados no mês atual.
-- Precisa bater com acceptsReports() em src/lib/months.ts.

create or replace function public.app_month_accepts_reports(p_ref_month date)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select
    public.app_is_admin()
    or p_ref_month = date_trunc('month', now())::date
    or p_ref_month = date_trunc('month', now() at time zone 'America/Sao_Paulo')::date
    or (
      p_ref_month = (date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '1 month')::date
      and extract(day from now() at time zone 'America/Sao_Paulo') <= 5
    );
$$;

-- unit_revenue_actuals
alter policy revenue_actuals_insert on public.unit_revenue_actuals
  with check (app_can_edit_unit(unit_id) and app_month_accepts_reports(ref_month) and source <> 'erp');
alter policy revenue_actuals_update on public.unit_revenue_actuals
  using (app_can_edit_unit(unit_id) and app_month_accepts_reports(ref_month))
  with check (app_can_edit_unit(unit_id) and app_month_accepts_reports(ref_month) and source <> 'erp');
alter policy revenue_actuals_delete on public.unit_revenue_actuals
  using (app_can_edit_unit(unit_id) and app_month_accepts_reports(ref_month));

-- seller_category_sales
alter policy scs_insert on public.seller_category_sales
  with check (
    app_can_edit_unit((select sellers.unit_id from sellers where sellers.id = seller_category_sales.seller_id))
    and app_month_accepts_reports(ref_month) and source <> 'erp'
  );
alter policy scs_update on public.seller_category_sales
  using (
    app_can_edit_unit((select sellers.unit_id from sellers where sellers.id = seller_category_sales.seller_id))
    and app_month_accepts_reports(ref_month)
  )
  with check (
    app_can_edit_unit((select sellers.unit_id from sellers where sellers.id = seller_category_sales.seller_id))
    and app_month_accepts_reports(ref_month) and source <> 'erp'
  );
alter policy scs_delete on public.seller_category_sales
  using (
    app_can_edit_unit((select sellers.unit_id from sellers where sellers.id = seller_category_sales.seller_id))
    and app_month_accepts_reports(ref_month)
  );

-- seller_campaign_sales
alter policy scas_insert on public.seller_campaign_sales
  with check (
    app_can_edit_unit((select sellers.unit_id from sellers where sellers.id = seller_campaign_sales.seller_id))
    and app_month_accepts_reports((select campaign_items.ref_month from campaign_items where campaign_items.id = seller_campaign_sales.campaign_item_id))
    and source <> 'erp'
  );
alter policy scas_update on public.seller_campaign_sales
  using (
    app_can_edit_unit((select sellers.unit_id from sellers where sellers.id = seller_campaign_sales.seller_id))
    and app_month_accepts_reports((select campaign_items.ref_month from campaign_items where campaign_items.id = seller_campaign_sales.campaign_item_id))
  )
  with check (
    app_can_edit_unit((select sellers.unit_id from sellers where sellers.id = seller_campaign_sales.seller_id))
    and app_month_accepts_reports((select campaign_items.ref_month from campaign_items where campaign_items.id = seller_campaign_sales.campaign_item_id))
    and source <> 'erp'
  );
alter policy scas_delete on public.seller_campaign_sales
  using (
    app_can_edit_unit((select sellers.unit_id from sellers where sellers.id = seller_campaign_sales.seller_id))
    and app_month_accepts_reports((select campaign_items.ref_month from campaign_items where campaign_items.id = seller_campaign_sales.campaign_item_id))
  );
