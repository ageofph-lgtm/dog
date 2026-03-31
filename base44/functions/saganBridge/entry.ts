import { createClient } from 'npm:@base44/sdk@0.8.23';

const SAGAN_SECRET = Deno.env.get('SAGAN_BRIDGE_SECRET') || 'sagan-watcher-bridge-2026';
const base44 = createClient({ appId: '690c7a2cb53713f70561ad65' });

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('x-sagan-secret');
    if (authHeader !== SAGAN_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, entity, query, data } = body;

    if (!action || !entity) {
      return Response.json({ error: 'Parâmetros obrigatórios: action, entity' }, { status: 400 });
    }

    const client = base44;
    const allowedEntities = ['FrotaACP', 'OrdemServico', 'Notificacao', 'Pedido', 'TechnicianCustomization'];
    if (!allowedEntities.includes(entity)) {
      return Response.json({ error: `Entidade não permitida: ${entity}` }, { status: 400 });
    }

    let result;
    switch (action) {
      case 'list':
        result = await client.entities[entity].list(); break;
      case 'filter':
        if (!query) return Response.json({ error: 'filter requer query' }, { status: 400 });
        result = await client.entities[entity].filter(query); break;
      case 'update':
        if (!query?.id || !data) return Response.json({ error: 'update requer query.id e data' }, { status: 400 });
        result = await client.entities[entity].update(query.id, data); break;
      case 'create':
        if (!data) return Response.json({ error: 'create requer data' }, { status: 400 });
        result = await client.entities[entity].create(data); break;
      case 'delete':
        if (!query?.id) return Response.json({ error: 'delete requer query.id' }, { status: 400 });
        result = await client.entities[entity].delete(query.id); break;
      default:
        return Response.json({ error: `Ação desconhecida: ${action}` }, { status: 400 });
    }

    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});