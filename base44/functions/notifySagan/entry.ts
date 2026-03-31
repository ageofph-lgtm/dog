Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { event, entity_name, entity_id, data, old_data } = body;
    const eventType = event?.type || 'unknown';

    console.log('[notifySagan] Recebido:', entity_name, eventType, entity_id);

    // Ignorar OrdemServico (admin-only)
    if (entity_name === 'OrdemServico') {
      console.log('[notifySagan] Ignorado: OrdemServico');
      return Response.json({ ok: true, skipped: true, reason: 'OrdemServico ignorado' });
    }

    // Para FrotaACP, filtrar apenas updates relevantes para técnicos
    if (entity_name === 'FrotaACP' && eventType === 'update') {
      const estadoChanged = data?.estado !== old_data?.estado;
      const pecasChanged = data?.aguardaPecas !== old_data?.aguardaPecas;
      const tecnicoChanged = data?.tecnico !== old_data?.tecnico;
      const tarefasChanged = JSON.stringify(data?.tarefas) !== JSON.stringify(old_data?.tarefas);
      
      if (!estadoChanged && !pecasChanged && !tecnicoChanged && !tarefasChanged) {
        console.log('[notifySagan] Ignorado: FrotaACP update sem campos relevantes');
        return Response.json({ ok: true, skipped: true, reason: 'Campos não relevantes' });
      }
    }

    // Construir mensagem legível para o Sagan
    let mensagem = '';
    
    if (entity_name === 'FrotaACP') {
      const serie = data?.serie || old_data?.serie || 'N/A';
      const modelo = data?.modelo || old_data?.modelo || '';
      
      if (eventType === 'create') {
        mensagem = `🆕 NOVA MÁQUINA REGISTADA\nModelo: ${modelo}\nSérie: ${serie}\nTipo: ${data?.tipo || 'nova'}`;
      } else if (eventType === 'delete') {
        mensagem = `🗑️ MÁQUINA REMOVIDA\nModelo: ${modelo}\nSérie: ${serie}`;
      } else if (eventType === 'update') {
        const mudancas = [];
        
        if (data?.estado !== old_data?.estado) {
          const estadoNovo = data?.estado?.replace(/-/g, ' ').toUpperCase();
          const estadoAntigo = old_data?.estado?.replace(/-/g, ' ').toUpperCase();
          mudancas.push(`Estado: ${estadoAntigo} → ${estadoNovo}`);
        }
        if (data?.tecnico !== old_data?.tecnico) {
          const tecNovo = data?.tecnico?.toUpperCase() || 'NENHUM';
          const tecAntigo = old_data?.tecnico?.toUpperCase() || 'NENHUM';
          mudancas.push(`Técnico: ${tecAntigo} → ${tecNovo}`);
        }
        if (data?.aguardaPecas !== old_data?.aguardaPecas) {
          mudancas.push(data?.aguardaPecas ? '⏳ Aguarda peças: SIM' : '✅ Aguarda peças: NÃO');
        }
        if (JSON.stringify(data?.tarefas) !== JSON.stringify(old_data?.tarefas)) {
          const concluidas = data?.tarefas?.filter(t => t.concluida).length || 0;
          const total = data?.tarefas?.length || 0;
          mudancas.push(`Tarefas: ${concluidas}/${total} concluídas`);
        }
        
        mensagem = `🔄 MÁQUINA ATUALIZADA\nModelo: ${modelo}\nSérie: ${serie}\n${mudancas.join('\n')}`;
      }
    } else if (entity_name === 'Pedido') {
      const numPedido = data?.numeroPedido || old_data?.numeroPedido || 'N/A';
      const maquina = data?.maquinaSerie || old_data?.maquinaSerie || '';
      const tecnico = data?.tecnico || old_data?.tecnico || '';
      
      if (eventType === 'create') {
        mensagem = `📦 NOVO PEDIDO DE PEÇAS\nNº Pedido: ${numPedido}\nMáquina: ${maquina}\nTécnico: ${tecnico?.toUpperCase()}`;
      } else if (eventType === 'update') {
        if (data?.status === 'concluido' && old_data?.status !== 'concluido') {
          mensagem = `✅ PEDIDO CONCLUÍDO\nNº Pedido: ${numPedido}\nMáquina: ${maquina}`;
        } else {
          mensagem = `📦 PEDIDO ATUALIZADO\nNº Pedido: ${numPedido}\nStatus: ${data?.status?.toUpperCase()}`;
        }
      } else if (eventType === 'delete') {
        mensagem = `🗑️ PEDIDO REMOVIDO\nNº Pedido: ${numPedido}`;
      }
    } else if (entity_name === 'Notificacao') {
      // Notificações internas - repassar para Sagan
      mensagem = `🔔 NOTIFICAÇÃO\n${data?.message || 'Nova notificação no sistema'}`;
      if (data?.machineSerie) mensagem += `\nMáquina: ${data.machineSerie}`;
      if (data?.technicianName) mensagem += `\nTécnico: ${data.technicianName}`;
    }

    if (!mensagem) {
      console.log('[notifySagan] Sem mensagem para enviar');
      return Response.json({ ok: true, skipped: true, reason: 'Sem mensagem relevante' });
    }

    console.log('[notifySagan] Mensagem:', mensagem);

    // Enviar para o Sagan via API
    const SAGAN_API_KEY = 'f8517554492e492090b62dd501ad7e14';
    const SAGAN_AGENT_ID = '69c166ad19149fb0c07883cb';
    const BASE_URL = 'https://app.base44.com/api/agents/' + SAGAN_AGENT_ID;
    const headers = { 'Content-Type': 'application/json', 'api_key': SAGAN_API_KEY };

    // Criar conversa
    const convRes = await fetch(BASE_URL + '/conversations', {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });
    const conv = await convRes.json();
    console.log('[notifySagan] Conversa criada:', conv.id);

    if (!conv.id) {
      return Response.json({ ok: false, error: 'Falha ao criar conversa', detail: conv }, { status: 500 });
    }

    // Enviar mensagem formatada + dados raw para o Sagan processar
    const conteudo = `WEBHOOK_WATCHER:\n${mensagem}\n\n---\nDADOS_RAW: ${JSON.stringify({ event_type: eventType, entity: entity_name, entity_id, data, old_data })}`;

    const msgRes = await fetch(BASE_URL + '/conversations/' + conv.id + '/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({ role: 'user', content: conteudo })
    });
    
    console.log('[notifySagan] Mensagem enviada, status:', msgRes.status);

    return Response.json({ 
      ok: true, 
      conversationId: conv.id, 
      msgStatus: msgRes.status,
      mensagem 
    });
  } catch (error) {
    console.error('[notifySagan] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});