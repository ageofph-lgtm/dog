Deno.serve(async (req) => {
  try {
    const webhookUrl = Deno.env.get('SAGAN_WEBHOOK_URL');
    if (!webhookUrl) {
      return Response.json({ error: 'SAGAN_WEBHOOK_URL não configurado' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const { event, entity_name, entity_id, data, old_data } = body;
    const eventType = event?.type || 'unknown';

    // Skip OrdemServico entirely (admin-managed)
    if (entity_name === 'OrdemServico') {
      return Response.json({ ok: true, skipped: true, reason: 'OS events are admin-only' });
    }

    // FrotaACP: only forward updates that change estado or aguardaPecas (technician actions)
    if (entity_name === 'FrotaACP') {
      if (eventType === 'create' || eventType === 'delete') {
        return Response.json({ ok: true, skipped: true, reason: 'FrotaACP create/delete are admin actions' });
      }
      if (eventType === 'update') {
        const estadoChanged = data?.estado !== old_data?.estado;
        const pecasChanged = data?.aguardaPecas !== old_data?.aguardaPecas;
        if (!estadoChanged && !pecasChanged) {
          return Response.json({ ok: true, skipped: true, reason: 'Non-technician field update' });
        }
      }
    }

    // Build summary
    let summary = '';

    if (entity_name === 'FrotaACP') {
      const serie = data?.serie || entity_id;
      if (eventType === 'update') {
        const oldEstado = old_data?.estado;
        const newEstado = data?.estado;
        if (oldEstado !== newEstado) {
          summary = `Máquina ${serie} mudou de estado: ${oldEstado} → ${newEstado}`;
        } else {
          summary = `Máquina ${serie} — aguarda peças: ${data?.aguardaPecas ? 'SIM' : 'NÃO'}`;
        }
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