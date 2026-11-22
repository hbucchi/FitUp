import { NUTRIENTS, fmt, type NutrientGroup, type Nutrients } from '../../domain/nutrients';
import { t } from '../../i18n';

const GROUP_LABEL: Record<NutrientGroup, string> = {
  energy: t('Energy'), macro: t('Macronutrients'), detail: t('Fats, sugars & fiber'), mineral: t('Minerals'), vitamin: t('Vitamins'), other: t('Other'),
};

export function NutrientTable({ n, showEmpty = false }: { n: Nutrients; showEmpty?: boolean }) {
  const rows: JSX.Element[] = [];
  let lastGroup: NutrientGroup | null = null;
  for (const def of NUTRIENTS) {
    const v = n[def.key];
    if (v == null && !showEmpty) continue;
    if (def.group !== lastGroup) {
      rows.push(<tr className="group" key={`g-${def.group}`}><td colSpan={3}>{GROUP_LABEL[def.group]}</td></tr>);
      lastGroup = def.group;
    }
    const dp = def.unit === 'g' || def.unit === 'kcal' ? (v != null && v < 10 ? 1 : 0) : v != null && v < 1 ? 2 : v != null && v < 10 ? 1 : 0;
    rows.push(
      <tr key={def.key}>
        <td>{def.label}</td>
        <td>{v == null ? '—' : `${fmt(v, dp)} ${def.unit}`}</td>
        <td>{def.dv && v != null ? `${Math.round((v / def.dv) * 100)}%` : ''}</td>
      </tr>,
    );
  }
  return (
    <table className="ntable">
      <tbody>{rows}</tbody>
    </table>
  );
}
