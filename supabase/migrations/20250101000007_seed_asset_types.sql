-- Seed the 33 operational asset types (User/Team/Workspace are tenancy
-- entities, already modeled as their own tables — see ARCHITECTURE.md §8.4 —
-- so they are intentionally not duplicated here as asset rows).

insert into asset_types (key, category, label_en, label_pt, label_es, icon, fields) values

('business_manager', 'meta', 'Business Manager', 'Business Manager', 'Business Manager', 'building-2', '[
  {"key":"bm_id","label_en":"BM ID","label_pt":"ID do BM","label_es":"ID del BM","type":"text","required":true},
  {"key":"verification_status","label_en":"Verification status","label_pt":"Status de verificação","label_es":"Estado de verificación","type":"select","required":false,"options":["unverified","pending","verified"]},
  {"key":"primary_admin_email","label_en":"Primary admin email","label_pt":"E-mail do admin principal","label_es":"Correo del admin principal","type":"text","required":false},
  {"key":"country","label_en":"Country","label_pt":"País","label_es":"País","type":"text","required":false}
]'),

('ad_account', 'meta', 'Ad Account', 'Conta de Anúncio', 'Cuenta Publicitaria', 'credit-card', '[
  {"key":"ad_account_id","label_en":"Ad account ID","label_pt":"ID da conta","label_es":"ID de la cuenta","type":"text","required":true},
  {"key":"currency","label_en":"Currency","label_pt":"Moeda","label_es":"Moneda","type":"text","required":true},
  {"key":"timezone","label_en":"Timezone","label_pt":"Fuso horário","label_es":"Zona horaria","type":"text","required":false},
  {"key":"spend_limit","label_en":"Spend limit","label_pt":"Limite de gasto","label_es":"Límite de gasto","type":"number","required":false}
]'),

('pixel', 'meta', 'Pixel', 'Pixel', 'Píxel', 'target', '[
  {"key":"pixel_id","label_en":"Pixel ID","label_pt":"ID do Pixel","label_es":"ID del Píxel","type":"text","required":true},
  {"key":"conversions_api_enabled","label_en":"Conversions API enabled","label_pt":"Conversions API ativa","label_es":"Conversions API activa","type":"boolean","required":false}
]'),

('facebook_page', 'meta', 'Facebook Page', 'Página do Facebook', 'Página de Facebook', 'flag', '[
  {"key":"page_id","label_en":"Page ID","label_pt":"ID da Página","label_es":"ID de la Página","type":"text","required":true},
  {"key":"page_url","label_en":"Page URL","label_pt":"URL da Página","label_es":"URL de la Página","type":"url","required":false},
  {"key":"category","label_en":"Category","label_pt":"Categoria","label_es":"Categoría","type":"text","required":false}
]'),

('instagram_account', 'meta', 'Instagram Account', 'Conta do Instagram', 'Cuenta de Instagram', 'instagram', '[
  {"key":"ig_id","label_en":"Instagram ID","label_pt":"ID do Instagram","label_es":"ID de Instagram","type":"text","required":true},
  {"key":"handle","label_en":"@handle","label_pt":"@usuário","label_es":"@usuario","type":"text","required":true}
]'),

('domain', 'meta', 'Domain', 'Domínio', 'Dominio', 'globe', '[
  {"key":"domain_name","label_en":"Domain name","label_pt":"Nome do domínio","label_es":"Nombre del dominio","type":"text","required":true},
  {"key":"registrar","label_en":"Registrar","label_pt":"Registrador","label_es":"Registrador","type":"text","required":false},
  {"key":"dns_provider","label_en":"DNS provider","label_pt":"Provedor de DNS","label_es":"Proveedor de DNS","type":"text","required":false},
  {"key":"expires_at","label_en":"Expires at","label_pt":"Expira em","label_es":"Expira el","type":"date","required":false}
]'),

('event', 'meta', 'Event', 'Evento', 'Evento', 'zap', '[
  {"key":"event_name","label_en":"Event name","label_pt":"Nome do evento","label_es":"Nombre del evento","type":"text","required":true},
  {"key":"source","label_en":"Source","label_pt":"Origem","label_es":"Origen","type":"select","required":false,"options":["pixel","conversions_api","both"]}
]'),

('conversion', 'meta', 'Conversion', 'Conversão', 'Conversión', 'trending-up', '[
  {"key":"conversion_name","label_en":"Conversion name","label_pt":"Nome da conversão","label_es":"Nombre de la conversión","type":"text","required":true},
  {"key":"value","label_en":"Value","label_pt":"Valor","label_es":"Valor","type":"number","required":false}
]'),

('profile', 'identity', 'Profile', 'Perfil', 'Perfil', 'user', '[
  {"key":"operator_name","label_en":"Operator name","label_pt":"Nome do operador","label_es":"Nombre del operador","type":"text","required":true},
  {"key":"browser_fingerprint","label_en":"Browser fingerprint ID","label_pt":"ID de fingerprint","label_es":"ID de fingerprint","type":"text","required":false}
]'),

('admin_profile', 'identity', 'Admin Profile', 'Perfil Admin', 'Perfil Admin', 'user-cog', '[
  {"key":"operator_name","label_en":"Operator name","label_pt":"Nome do operador","label_es":"Nombre del operador","type":"text","required":true},
  {"key":"access_level","label_en":"Access level","label_pt":"Nível de acesso","label_es":"Nivel de acceso","type":"select","required":false,"options":["full","partial","read_only"]}
]'),

('backup_profile', 'identity', 'Backup Profile', 'Perfil Backup', 'Perfil de Respaldo', 'user-check', '[
  {"key":"primary_profile_name","label_en":"Primary profile (reference)","label_pt":"Perfil primário (referência)","label_es":"Perfil primario (referencia)","type":"text","required":false},
  {"key":"ready_state","label_en":"Ready state","label_pt":"Estado de prontidão","label_es":"Estado de preparación","type":"select","required":false,"options":["ready","warming_up","not_ready"]}
]'),

('payment_method', 'commercial', 'Payment Method', 'Método de Pagamento', 'Método de Pago', 'wallet', '[
  {"key":"method_type","label_en":"Type","label_pt":"Tipo","label_es":"Tipo","type":"select","required":true,"options":["credit_card","paypal","bank_transfer","other"]},
  {"key":"last_four","label_en":"Last 4 digits","label_pt":"Últimos 4 dígitos","label_es":"Últimos 4 dígitos","type":"text","required":false},
  {"key":"billing_threshold","label_en":"Billing threshold","label_pt":"Limite de faturamento","label_es":"Umbral de facturación","type":"number","required":false}
]'),

('company', 'organizational', 'Company', 'Empresa', 'Empresa', 'building', '[
  {"key":"legal_name","label_en":"Legal name","label_pt":"Razão social","label_es":"Razón social","type":"text","required":true},
  {"key":"tax_id","label_en":"Tax ID","label_pt":"CNPJ/CPF","label_es":"NIF","type":"text","required":false},
  {"key":"country","label_en":"Country","label_pt":"País","label_es":"País","type":"text","required":false}
]'),

('business_verification', 'governance', 'Business Verification', 'Verificação de Negócio', 'Verificación de Negocio', 'shield-check', '[
  {"key":"verification_status","label_en":"Status","label_pt":"Status","label_es":"Estado","type":"select","required":true,"options":["not_started","pending","verified","rejected"]},
  {"key":"submitted_at","label_en":"Submitted at","label_pt":"Enviado em","label_es":"Enviado el","type":"date","required":false}
]'),

('identity_verification', 'governance', 'Identity Verification', 'Verificação de Identidade', 'Verificación de Identidad', 'id-card', '[
  {"key":"verification_status","label_en":"Status","label_pt":"Status","label_es":"Estado","type":"select","required":true,"options":["not_started","pending","verified","rejected"]},
  {"key":"document_type","label_en":"Document type","label_pt":"Tipo de documento","label_es":"Tipo de documento","type":"text","required":false}
]'),

('partner', 'organizational', 'Partner', 'Parceiro', 'Socio', 'handshake', '[
  {"key":"contact_name","label_en":"Contact name","label_pt":"Nome do contato","label_es":"Nombre de contacto","type":"text","required":false},
  {"key":"contact_email","label_en":"Contact email","label_pt":"E-mail do contato","label_es":"Correo de contacto","type":"text","required":false}
]'),

('agency', 'organizational', 'Agency', 'Agência', 'Agencia', 'briefcase', '[
  {"key":"agency_id","label_en":"Agency BM ID","label_pt":"ID do BM da Agência","label_es":"ID del BM de la Agencia","type":"text","required":false},
  {"key":"contact_email","label_en":"Contact email","label_pt":"E-mail do contato","label_es":"Correo de contacto","type":"text","required":false}
]'),

('virtual_machine', 'infrastructure', 'Virtual Machine', 'Máquina Virtual', 'Máquina Virtual', 'server', '[
  {"key":"provider","label_en":"Provider","label_pt":"Provedor","label_es":"Proveedor","type":"text","required":true},
  {"key":"region","label_en":"Region","label_pt":"Região","label_es":"Región","type":"text","required":false},
  {"key":"ip_address","label_en":"IP address","label_pt":"Endereço IP","label_es":"Dirección IP","type":"text","required":false},
  {"key":"os","label_en":"Operating system","label_pt":"Sistema operacional","label_es":"Sistema operativo","type":"text","required":false}
]'),

('browser', 'infrastructure', 'Browser', 'Navegador', 'Navegador', 'app-window', '[
  {"key":"browser_profile_id","label_en":"Browser profile ID","label_pt":"ID do perfil de navegador","label_es":"ID del perfil de navegador","type":"text","required":false},
  {"key":"antidetect_platform","label_en":"Antidetect platform","label_pt":"Plataforma antidetect","label_es":"Plataforma antidetect","type":"text","required":false}
]'),

('proxy', 'infrastructure', 'Proxy', 'Proxy', 'Proxy', 'network', '[
  {"key":"proxy_type","label_en":"Type","label_pt":"Tipo","label_es":"Tipo","type":"select","required":true,"options":["residential","datacenter","mobile","isp"]},
  {"key":"endpoint","label_en":"Endpoint","label_pt":"Endpoint","label_es":"Endpoint","type":"text","required":false},
  {"key":"country","label_en":"Country","label_pt":"País","label_es":"País","type":"text","required":false}
]'),

('vpn', 'infrastructure', 'VPN', 'VPN', 'VPN', 'shield', '[
  {"key":"provider","label_en":"Provider","label_pt":"Provedor","label_es":"Proveedor","type":"text","required":false},
  {"key":"region","label_en":"Region","label_pt":"Região","label_es":"Región","type":"text","required":false}
]'),

('product', 'commercial', 'Product', 'Produto', 'Producto', 'package', '[
  {"key":"sku","label_en":"SKU","label_pt":"SKU","label_es":"SKU","type":"text","required":false},
  {"key":"price","label_en":"Price","label_pt":"Preço","label_es":"Precio","type":"number","required":false}
]'),

('offer', 'commercial', 'Offer', 'Oferta', 'Oferta', 'tag', '[
  {"key":"offer_price","label_en":"Offer price","label_pt":"Preço da oferta","label_es":"Precio de la oferta","type":"number","required":false},
  {"key":"active_from","label_en":"Active from","label_pt":"Ativa a partir de","label_es":"Activa desde","type":"date","required":false}
]'),

('campaign', 'campaign', 'Campaign', 'Campanha', 'Campaña', 'megaphone', '[
  {"key":"campaign_id","label_en":"Campaign ID","label_pt":"ID da Campanha","label_es":"ID de la Campaña","type":"text","required":false},
  {"key":"objective","label_en":"Objective","label_pt":"Objetivo","label_es":"Objetivo","type":"text","required":false},
  {"key":"daily_budget","label_en":"Daily budget","label_pt":"Orçamento diário","label_es":"Presupuesto diario","type":"number","required":false}
]'),

('creative', 'campaign', 'Creative', 'Criativo', 'Creativo', 'image', '[
  {"key":"format","label_en":"Format","label_pt":"Formato","label_es":"Formato","type":"select","required":false,"options":["image","video","carousel","collection"]},
  {"key":"asset_url","label_en":"Asset URL","label_pt":"URL do ativo","label_es":"URL del activo","type":"url","required":false}
]'),

('landing_page', 'campaign', 'Landing Page', 'Landing Page', 'Landing Page', 'file-text', '[
  {"key":"url","label_en":"URL","label_pt":"URL","label_es":"URL","type":"url","required":true},
  {"key":"hosting_provider","label_en":"Hosting provider","label_pt":"Provedor de hospedagem","label_es":"Proveedor de hosting","type":"text","required":false}
]'),

('audience', 'campaign', 'Audience', 'Público', 'Audiencia', 'users', '[
  {"key":"size_estimate","label_en":"Size estimate","label_pt":"Tamanho estimado","label_es":"Tamaño estimado","type":"number","required":false}
]'),

('custom_audience', 'campaign', 'Custom Audience', 'Público Personalizado', 'Audiencia Personalizada', 'users-round', '[
  {"key":"source","label_en":"Source","label_pt":"Origem","label_es":"Origen","type":"text","required":false},
  {"key":"size_estimate","label_en":"Size estimate","label_pt":"Tamanho estimado","label_es":"Tamaño estimado","type":"number","required":false}
]'),

('lookalike_audience', 'campaign', 'Lookalike Audience', 'Público Semelhante', 'Audiencia Similar', 'users-round', '[
  {"key":"source_audience","label_en":"Source audience (reference)","label_pt":"Público de origem (referência)","label_es":"Audiencia de origen (referencia)","type":"text","required":false},
  {"key":"similarity_pct","label_en":"Similarity %","label_pt":"% de semelhança","label_es":"% de similitud","type":"number","required":false}
]'),

('integration', 'integration', 'Integration', 'Integração', 'Integración', 'plug', '[
  {"key":"provider","label_en":"Provider","label_pt":"Provedor","label_es":"Proveedor","type":"text","required":true},
  {"key":"connection_status","label_en":"Connection status","label_pt":"Status da conexão","label_es":"Estado de la conexión","type":"select","required":false,"options":["connected","disconnected","error"]}
]'),

('document', 'knowledge', 'Document', 'Documento', 'Documento', 'file', '[
  {"key":"doc_type","label_en":"Document type","label_pt":"Tipo de documento","label_es":"Tipo de documento","type":"text","required":false}
]'),

('playbook', 'knowledge', 'Playbook', 'Playbook', 'Playbook', 'book-open', '[
  {"key":"applies_to","label_en":"Applies to (asset type)","label_pt":"Aplica-se a (tipo de ativo)","label_es":"Aplica a (tipo de activo)","type":"text","required":false}
]'),

('incident', 'operational', 'Incident', 'Incidente', 'Incidente', 'alert-triangle', '[
  {"key":"severity","label_en":"Severity","label_pt":"Severidade","label_es":"Severidad","type":"select","required":true,"options":["low","medium","high","critical"]},
  {"key":"detected_by","label_en":"Detected by","label_pt":"Detectado por","label_es":"Detectado por","type":"select","required":false,"options":["automation","manual"]}
]')

on conflict (key) do nothing;
