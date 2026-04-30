import React from "react";
import {
  Calendar, User, Wrench, Clock, Zap, AlertTriangle,
  MoreVertical, Pencil, Trash2, CheckSquare, Timer
} from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useElapsedTimer, formatDuration } from "./TimerButton";

// ── Status colors ─────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  'a-fazer':        { bar: '#64748B', text: '#94A3B8' },
  'em-progresso':   { bar: '#3B82F6', text: '#60A5FA' },
  'aguarda':        { bar: '#F59E0B', text: '#FCD34D' },
  'concluido':      { bar: '#22C55E', text: '#4ADE80' },
  'cancelado':      { bar: '#EF4444', text: '#F87171' },
};

const getStatusColor = (status) => {
  for (const [key, val] of Object.entries(STATUS_COLORS)) {
    if (status?.includes(key)) return val;
  }
  return { bar: '#6B7280', text: '#9CA3AF' };
};

// ── Priority ──────────────────────────────────────────────────────────────────
const PRIORITY = {
  'urgente': { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', label: 'URG' },
  'alta':    { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', label: 'ALTA' },
  'normal':  { color: '#64748B', bg: 'rgba(100,116,139,0.1)', label: 'NRM' },
};

// ── Origin ────────────────────────────────────────────────────────────────────
const ORIGIN = {
  'nova': { label: 'NOVA', color: '#3B82F6' },
  'sts':  { label: 'STS',  color: '#22C55E' },
  'uts':  { label: 'UTS',  color: '#F59E0B' },
};

// ── Timer display inline ──────────────────────────────────────────────────────
function InlineTimer({ os, isDark }) {
  const elapsed = useElapsedTimer(os);
  const ativo   = Boolean(os?.actualStartTime) || (os?.timer_ativo === true && os?.timer_pausado !== true);
  const pausado = !ativo && (os?.status === 'Pausado' || os?.timer_pausado === true);
  const done    = !ativo && (os?.status === 'Concluída' || os?.actualEndDate || os?.actualEndTime || os?.timer_fim);

  if (elapsed === null && !done) return null;

  const color = ativo && !pausado ? '#22C55E' : pausado ? '#F59E0B' : isDark ? '#4B5563' : '#9CA3AF';
  const label = formatDuration(elapsed);
  if (!label) return null;

  return (
    <div className="flex items-center gap-1" style={{ color }}>
      <Timer className="w-3 h-3" />
      <span className="font-mono text-[10px] font-bold tabular-nums">{label}</span>
      {ativo && !pausado && (
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />
      )}
    </div>
  );
}

// ── Main Card ─────────────────────────────────────────────────────────────────
export default function OSCard({
  os, onOpenDetails, onEdit, onDelete, onStatusChange,
  allStatuses, userPermissions, isTop = false, isDragging = false, isDark = true
}) {
  const completedTasks = os.tasks?.filter(t => t.completed).length || 0;
  const totalTasks     = os.tasks?.length || 0;
  const progress       = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const isOverdue = () => {
    if (!os.dataEntrega || os.status === 'concluido') return false;
    const d = new Date(os.dataEntrega); const t = new Date();
    d.setHours(0,0,0,0); t.setHours(0,0,0,0);
    return d < t;
  };

  const overdue     = isOverdue();
  const priority    = PRIORITY[os.prioridade] || PRIORITY.normal;
  const originInfo  = os.origemMaquina ? (ORIGIN[os.origemMaquina] || null) : null;
  const statusColor = getStatusColor(os.status);
  const hasReserve  = os.caracteristicasMaquina?.reserva || os.reserva;

  // Theme tokens
  const surface   = isDark ? '#111827' : '#FFFFFF';
  const border    = isDragging ? '#3B82F6'
                  : isDark    ? '#1F2937'
                  : '#E5E7EB';
  const textMain  = isDark ? '#F9FAFB' : '#111827';
  const textSub   = isDark ? '#6B7280' : '#6B7280';
  const divider   = isDark ? '#1F2937' : '#F3F4F6';

  return (
    <div
      className={`w-full select-none ${isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
      onClick={isTop && !isDragging ? () => onOpenDetails(os) : undefined}
    >
      <div
        className="relative flex flex-col overflow-hidden transition-all duration-150"
        style={{
          background: surface,
          border: `1px solid ${border}`,
          borderRadius: '8px',
          borderLeft: `3px solid ${statusColor.bar}`,
          boxShadow: isDragging
            ? '0 16px 48px rgba(0,0,0,0.4), 0 4px 16px rgba(59,130,246,0.3)'
            : isDark
              ? '0 1px 4px rgba(0,0,0,0.4)'
              : '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        {/* ── ROW 1: Modelo + Menus ─────────────────────────── */}
        <div className="flex items-start justify-between px-3 pt-3 pb-1 gap-2">
          <div className="flex-1 min-w-0">
            {/* Modelo */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="font-bold text-sm leading-tight truncate"
                style={{ color: textMain, fontFamily: "'Inter', sans-serif", letterSpacing: '-0.01em' }}
              >
                {os.modelo}
              </span>
              {os.ano && (
                <span className="text-[10px] font-mono" style={{ color: textSub }}>
                  {os.ano}
                </span>
              )}
            </div>
            {/* Série */}
            <span
              className="font-mono text-xs font-semibold tracking-wider"
              style={{ color: statusColor.text }}
            >
              {os.serie}
            </span>
          </div>

          {/* Action menu */}
          {isTop && !isDragging && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button
                  className="p-1 rounded-md transition-colors hover:bg-black/10 dark:hover:bg-white/10 flex-shrink-0 mt-0.5"
                  style={{ color: textSub }}
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 z-50"
                style={{
                  background: isDark ? '#1F2937' : '#FFFFFF',
                  border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                  borderRadius: '8px',
                }}
              >
                {Object.entries(allStatuses || {}).map(([key, cfg]) => {
                  if (key === os.status) return null;
                  if (!userPermissions?.canAccessOSStatus?.(key)) return null;
                  const Icon = cfg.icon;
                  return (
                    <DropdownMenuItem
                      key={key}
                      onClick={(e) => { e.stopPropagation(); onStatusChange(os.id, key); }}
                      className="cursor-pointer text-xs"
                      style={{ color: isDark ? '#D1D5DB' : '#374151' }}
                    >
                      <Icon className="w-3.5 h-3.5 mr-2 opacity-60" />
                      {cfg.title}
                    </DropdownMenuItem>
                  );
                })}
                {userPermissions?.canEditOS && onEdit && (
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onEdit(os); }}
                    className="cursor-pointer text-xs"
                    style={{ color: '#3B82F6' }}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
                  </DropdownMenuItem>
                )}
                {userPermissions?.canDeleteOS && onDelete && (
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onDelete(os.id); }}
                    className="cursor-pointer text-xs text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Eliminar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* ── ROW 2: Badges ─────────────────────────────────── */}
        <div className="flex items-center gap-1.5 px-3 py-1 flex-wrap">
          {/* Priority */}
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{
              background: priority.bg,
              color: priority.color,
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
            }}
          >
            {priority.label}
          </span>

          {/* Origin */}
          {originInfo && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: `${originInfo.color}18`,
                color: originInfo.color,
                fontFamily: 'monospace',
              }}
            >
              {originInfo.label}
            </span>
          )}

          {/* Overdue */}
          {overdue && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', fontFamily: 'monospace' }}
            >
              <AlertTriangle className="w-2.5 h-2.5" />
              ATRASO
            </span>
          )}

          {/* Reserved */}
          {hasReserve && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', fontFamily: 'monospace' }}
            >
              RES
            </span>
          )}
        </div>

        {/* ── DIVIDER ───────────────────────────────────────── */}
        <div style={{ height: '1px', background: divider, margin: '0 12px' }} />

        {/* ── ROW 3: Meta info ──────────────────────────────── */}
        <div className="px-3 py-2 space-y-1.5">
          {os.cliente && (
            <div className="flex items-center gap-1.5">
              <User className="w-3 h-3 flex-shrink-0" style={{ color: textSub }} />
              <span className="text-xs truncate" style={{ color: textSub }}>{os.cliente}</span>
            </div>
          )}

          {os.tecnicoResponsavel && (
            <div className="flex items-center gap-1.5">
              <Wrench className="w-3 h-3 flex-shrink-0" style={{ color: textSub }} />
              <span className="text-xs truncate capitalize" style={{ color: textSub }}>{os.tecnicoResponsavel}</span>
            </div>
          )}

          {os.dataEntrega && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 flex-shrink-0" style={{ color: overdue ? '#EF4444' : textSub }} />
              <span
                className="text-xs font-mono"
                style={{ color: overdue ? '#EF4444' : textSub }}
              >
                {format(new Date(os.dataEntrega), 'dd/MM/yy')}
              </span>
            </div>
          )}

          {/* Timer inline */}
          <InlineTimer os={os} isDark={isDark} />
        </div>

        {/* ── ROW 4: Task progress ──────────────────────────── */}
        {totalTasks > 0 && (
          <div className="px-3 pb-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <CheckSquare className="w-3 h-3" style={{ color: textSub }} />
                <span className="text-[10px] font-mono" style={{ color: textSub }}>
                  {completedTasks}/{totalTasks}
                </span>
              </div>
              <span
                className="text-[10px] font-mono font-bold"
                style={{ color: progress === 100 ? '#22C55E' : statusColor.text }}
              >
                {Math.round(progress)}%
              </span>
            </div>
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: '3px', background: isDark ? '#1F2937' : '#E5E7EB' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: progress === 100
                    ? '#22C55E'
                    : `linear-gradient(90deg, ${statusColor.bar}, ${statusColor.text})`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
