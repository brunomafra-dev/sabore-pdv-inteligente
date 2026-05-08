delete from public.whatsapp_templates
where unit_id = '00000000-0000-4000-8000-000000000101';

delete from public.inventory_movements
where unit_id = '00000000-0000-4000-8000-000000000101';

delete from public.cash_sessions
where unit_id = '00000000-0000-4000-8000-000000000101';

delete from public.payments
where order_id in (
  select id from public.orders
  where unit_id = '00000000-0000-4000-8000-000000000101'
);

delete from public.order_items
where order_id in (
  select id from public.orders
  where unit_id = '00000000-0000-4000-8000-000000000101'
);

delete from public.orders
where unit_id = '00000000-0000-4000-8000-000000000101';

delete from public.recipe_items
where product_id in (
  select id from public.products
  where unit_id = '00000000-0000-4000-8000-000000000101'
);

delete from public.products
where unit_id = '00000000-0000-4000-8000-000000000101';

delete from public.inventory_lots
where ingredient_id in (
  select id from public.ingredients
  where unit_id = '00000000-0000-4000-8000-000000000101'
);

delete from public.ingredients
where unit_id = '00000000-0000-4000-8000-000000000101';

delete from public.customers
where unit_id = '00000000-0000-4000-8000-000000000101';

delete from public.dining_tables
where unit_id = '00000000-0000-4000-8000-000000000101';

delete from public.user_profiles
where unit_id = '00000000-0000-4000-8000-000000000101';

delete from public.restaurant_units
where id = '00000000-0000-4000-8000-000000000101';

delete from public.organizations
where id = '00000000-0000-4000-8000-000000000001';

insert into public.organizations (id, name, logo_url, plan_code, plan_price)
values (
  '00000000-0000-4000-8000-000000000001',
  'Pizza e Cia',
  '/logos/pizza-e-cia.svg',
  'essential',
  59.90
);

insert into public.restaurant_units (id, organization_id, name, city, neighborhood, fiscal_enabled)
values (
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000001',
  'Pizza e Cia Ponta Verde',
  'Maceio',
  'Ponta Verde',
  false
);

insert into public.user_profiles (id, unit_id, name, role)
values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', 'Bruno', 'owner'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000101', 'Ana Caixa', 'cashier'),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000101', 'Rafa Cozinha', 'kitchen');

insert into public.dining_tables (id, unit_id, label, seats, status)
values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000101', 'Mesa 1', 2, 'free'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000101', 'Mesa 2', 4, 'free'),
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000101', 'Mesa 3', 6, 'free'),
  ('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000101', 'Mesa 4', 4, 'free');

insert into public.customers (id, unit_id, name, phone, neighborhood)
values
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000101', 'Maria Eduarda', '+5582999991111', 'Jatiuca'),
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000101', 'Victor Lima', '+5582999992222', 'Ponta Verde');

insert into public.ingredients (id, unit_id, name, measure, average_cost, minimum_stock)
values
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000101', 'Farinha italiana 00', 'kg', 5.00, 25),
  ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000101', 'Molho de tomate da casa', 'kg', 10.00, 10),
  ('00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000101', 'Mussarela fatiada', 'kg', 34.00, 12),
  ('00000000-0000-4000-8000-000000000504', '00000000-0000-4000-8000-000000000101', 'Calabresa artesanal', 'kg', 28.00, 6),
  ('00000000-0000-4000-8000-000000000505', '00000000-0000-4000-8000-000000000101', 'Frango desfiado', 'kg', 22.00, 6),
  ('00000000-0000-4000-8000-000000000506', '00000000-0000-4000-8000-000000000101', 'Catupiry bisnaga', 'kg', 42.00, 4),
  ('00000000-0000-4000-8000-000000000507', '00000000-0000-4000-8000-000000000101', 'Pepperoni', 'kg', 48.00, 4);

insert into public.inventory_lots (id, ingredient_id, supplier, batch_code, quantity, expires_at, received_at)
values
  ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000501', 'Atacadao AL', 'FAR-0426', 50, '2026-08-20', '2026-04-25'),
  ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000502', 'Ceasa', 'MOL-0501', 13.5, '2026-05-09', '2026-05-01'),
  ('00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000000503', 'Laticinio Sertao', 'MUS-0501', 8, '2026-05-06', '2026-05-01'),
  ('00000000-0000-4000-8000-000000000604', '00000000-0000-4000-8000-000000000504', 'Casa das Carnes', 'CAL-0429', 7.2, '2026-05-08', '2026-04-29'),
  ('00000000-0000-4000-8000-000000000605', '00000000-0000-4000-8000-000000000505', 'Avicola Ponta Verde', 'FRG-0502', 6.4, '2026-05-07', '2026-05-02'),
  ('00000000-0000-4000-8000-000000000606', '00000000-0000-4000-8000-000000000506', 'Distribuidora Sul', 'CAT-0428', 4.8, '2026-05-12', '2026-04-28'),
  ('00000000-0000-4000-8000-000000000607', '00000000-0000-4000-8000-000000000507', 'Casa das Carnes', 'PEP-0501', 3, '2026-05-07', '2026-05-01');

insert into public.products (id, unit_id, name, category, price, active, preparation_area)
values
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000101', 'Pizza brotinho - monte sua', 'Pizzas', 20.00, true, 'kitchen'),
  ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000101', 'Pizza grande - monte sua', 'Pizzas', 45.00, true, 'kitchen'),
  ('00000000-0000-4000-8000-000000000704', '00000000-0000-4000-8000-000000000101', 'Coca-Cola lata 350 ml', 'Refrigerantes', 7.00, true, 'bar'),
  ('00000000-0000-4000-8000-000000000705', '00000000-0000-4000-8000-000000000101', 'Coca-Cola 600 ml', 'Refrigerantes', 9.50, true, 'bar'),
  ('00000000-0000-4000-8000-000000000706', '00000000-0000-4000-8000-000000000101', 'Coca-Cola 2 litros', 'Refrigerantes', 16.90, true, 'bar'),
  ('00000000-0000-4000-8000-000000000707', '00000000-0000-4000-8000-000000000101', 'Guarana Antarctica lata 350 ml', 'Refrigerantes', 6.50, true, 'bar'),
  ('00000000-0000-4000-8000-000000000708', '00000000-0000-4000-8000-000000000101', 'Guarana Antarctica 1 litro', 'Refrigerantes', 11.00, true, 'bar'),
  ('00000000-0000-4000-8000-000000000709', '00000000-0000-4000-8000-000000000101', 'Guarana Antarctica 2 litros', 'Refrigerantes', 15.90, true, 'bar'),
  ('00000000-0000-4000-8000-000000000710', '00000000-0000-4000-8000-000000000101', 'Suco natural de laranja 500 ml', 'Sucos', 10.00, true, 'bar'),
  ('00000000-0000-4000-8000-000000000711', '00000000-0000-4000-8000-000000000101', 'Suco integral de uva 1 litro', 'Sucos', 15.00, true, 'bar'),
  ('00000000-0000-4000-8000-000000000712', '00000000-0000-4000-8000-000000000101', 'Agua mineral 500 ml', 'Bebidas', 4.00, true, 'bar');

insert into public.recipe_items (id, product_id, ingredient_id, quantity)
values
  ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000501', 0.20),
  ('00000000-0000-4000-8000-000000000802', '00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000502', 0.08),
  ('00000000-0000-4000-8000-000000000803', '00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000503', 0.18),
  ('00000000-0000-4000-8000-000000000804', '00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000501', 0.48),
  ('00000000-0000-4000-8000-000000000805', '00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000502', 0.18),
  ('00000000-0000-4000-8000-000000000806', '00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000503', 0.42);

insert into public.orders (id, unit_id, code, channel, status, table_id, customer_id, delivery_fee, discount, fiscal_status, whatsapp_status, opened_at)
values
  ('00000000-0000-4000-8000-000000000903', '00000000-0000-4000-8000-000000000101', '100', 'counter', 'paid', null, null, 0, 0, 'disabled', 'not_sent', '2026-05-03T10:42:00-03:00');

insert into public.order_items (id, order_id, product_id, quantity, custom_name, unit_price, notes)
values
  ('00000000-0000-4000-8000-000000001005', '00000000-0000-4000-8000-000000000903', '00000000-0000-4000-8000-000000000701', 1, 'Brotinho Mussarela', 20.00, '4 fatias. Sem adicionais.'),
  ('00000000-0000-4000-8000-000000001006', '00000000-0000-4000-8000-000000000903', '00000000-0000-4000-8000-000000000707', 1, null, null, null);

insert into public.payments (id, order_id, method, amount, received_at)
values ('00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000000903', 'pix', 26.50, '2026-05-03T10:50:00-03:00');

insert into public.cash_sessions (id, unit_id, opened_by, opened_at, opening_amount, expected_amount, status)
values (
  '00000000-0000-4000-8000-000000001201',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000202',
  '2026-05-03T11:30:00-03:00',
  150,
  176.50,
  'open'
);

insert into public.inventory_movements (id, unit_id, ingredient_id, type, quantity, cost_impact, reason, created_at)
values
  ('00000000-0000-4000-8000-000000001301', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000503', 'receipt', 8, 272.00, 'Recebimento Laticinio Sertao', '2026-05-01T09:12:00-03:00'),
  ('00000000-0000-4000-8000-000000001302', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000502', 'waste', -0.6, 6.00, 'Molho vencendo descartado na abertura', '2026-05-03T08:50:00-03:00');

insert into public.whatsapp_templates (id, unit_id, name, category, status, monthly_price)
values
  ('00000000-0000-4000-8000-000000001401', '00000000-0000-4000-8000-000000000101', 'pedido_status_delivery', 'utility', 'approved', null),
  ('00000000-0000-4000-8000-000000001402', '00000000-0000-4000-8000-000000000101', 'promocao_semana', 'marketing', 'draft', 30.00);
