import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const webhookUrl = Deno.env.get('SAGAN_WEBHOOK_URL');
    if (!webhookUrl) {
      return Response.json({ error: 'SAGAN_WEBHOOK_URL não configurado' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const { event, entity_name, entity_id, data, old_data } = body;

    // Build a human-readable summary for Sagan
    let summary = '';
    const eventType = event?.type || 'unknown';

    if (entity_name === 'FrotaACP') {
      const serie = data?.serie || entity_id;
      const modelo = data?.modelo || '';
      if (eventType === 'create') {
        summary = `Nova máquina criada: ${modelo} (${serie})`;
      } else if (eventType === 'update') {
        const oldEstado = old_data?.estado;
        const newEstado = data?.estado;
        if (oldEstado !== newEstado) {
          summary = `Máquina ${serie} mudou de estado: ${oldEstado} → ${newEstado}`;
        } else if (data?.aguardaPecas !== old_data?.aguardaPecas) {
          summary = `Máquina ${serie} — aguarda peças: ${data?.aguardaPecas ? 'SIM' : 'NÃO'}`;
        } else {
          summary = `Máquina ${serie} (${modelo}) atualizada`;
        }
      } else if (eventType === 'delete') {
        summary = `Máquina removida: ${serie}`;
      }
    } else if (entity_name === 'Pedido') {
      const num = data?.numeroPedido || entity_id;
      const tecnico = data?.tecnico || '';
      const maquina = data?.maquinaSerie || '';
      if (eventType === 'create') {
        summary = `Novo pedido #${num} criado por ${tecnico} para máquina ${maquina}`;
      } else if (eventType === 'update') {
        const oldStatus = old_data?.status;
        const newStatus = data?.status;
        if (oldStatus !== newStatus) {
          summary = `Pedido #${num} mudou de estado: ${oldStatus} → ${newStatus}`;
        } else {
          summary = `Pedido #${num} atualizado por ${tecnico}`;
        }
      } else if (eventType === 'delete') {
        summary = `Pedido #${num} removido`;
      }
    } else if (entity_name === 'OrdemServico') {
      const serie = data?.serie || entity_id;
      const cliente = data?.cliente || '';
      if (eventType === 'create') {
        summary = `Nova Ordem de Serviço criada: ${serie} — Cliente: ${cliente}`;
      } else if (eventType === 'update') {
        const oldStatus = old_data?.status;
        const newStatus = data?.status;
        if (oldStatus !== newStatus) {
          summary = `OS ${serie} mudou de estado: ${oldStatus} → ${newStatus}`;
        } else {
          summary = `OS ${serie} atualizada`;
        }
      } else if (eventType === 'delete') {
        summary = `OS ${serie} removida`;
      }
    } else {
      summary = `Evento ${eventType} em ${entity_name} (id: ${entity_id})`;
    }

    const payload = {
      source: 'watcher',
      event: eventType,
      entity: entity_name,
      entity_id,
      summary,
      timestamp: new Date().toISOString(),
      data,
      old_data
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return Response.json({ ok: true, saganStatus: response.status, summary });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});