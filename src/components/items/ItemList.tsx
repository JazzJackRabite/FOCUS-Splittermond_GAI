import React from 'react';
import { Knopf } from '../../fundament';
import { SourceBadge } from '../ui/SourceBadge';
import type { ItemEntry, AppMode } from '../../types';
import {
  getStrengthDetails,
  getWeaknessDetails,
  getResourceDetails,
  getLanguageDetails,
  getResolvedResources,
} from '../../utils/gameResourceManager';

interface ItemListProps {
  items: ItemEntry[];
  onDelete: (idx: number) => void;
  typeLabel: string;
  showCosts: boolean;
  xpMultiplier?: number;
  mode?: AppMode;
}

export const ItemList: React.FC<ItemListProps> = ({
  items,
  onDelete,
  typeLabel,
  showCosts,
  xpMultiplier = 5,
  mode = 'creation',
}) => {
  if (items.length === 0) {
    return (
      <div className="text-leise text-sm italic p-2">Keine {typeLabel} gewählt</div>
    );
  }
  return (
    <div className="space-y-2 mt-2">
      {items.map((item, idx) => {
        const itemLevel = item.level ?? 1;
        const itemPointCost = item.pointCost !== undefined ? item.pointCost : 1;
        const epStufen = Number(item.xpStufen) || 0;
        const creationCost = (itemLevel - epStufen) * itemPointCost;
        const xpCost = itemLevel * itemPointCost * xpMultiplier;

        // Schwächen: ablegen oder ersetzen beim Erreichen eines neuen Heldengrades (GRW S. 84) – ohne EP
        const istSchwaeche = typeLabel.includes('Schwäch');
        const canDelete = mode === 'creation'
          ? !item.isRacial
          : istSchwaeche || (item.source === 'xp' && !item.isRacial && !item.isFree && item.pointCost !== 0);

        let details: { desc: string; source: string; page?: number } | null = null;
        if (typeLabel.includes('Sprach')) {
          details = getLanguageDetails(item.name, item.desc);
        } else if (typeLabel.includes('Schwäch')) {
          details = getWeaknessDetails(item.name, item.desc);
        } else if (typeLabel.includes('Stärk')) {
          details = getStrengthDetails(item.name, item.desc);
        } else if (typeLabel.includes('Ressourc')) {
          details = getResourceDetails(item.name, item.desc);
        }

        const rawSrc = item.sourceRef || item.source;
        const isGenericSource = !rawSrc || rawSrc === 'creation' || rawSrc === 'xp' || rawSrc === 'Regelwerk' || rawSrc === 'Erschaffung';
        const source = isGenericSource ? (details?.source || 'GRW') : rawSrc;
        const page = item.page ?? details?.page;
        const description = item.desc || details?.desc;

        return (
          <div
            key={idx}
            className="flex justify-between items-start bg-seite p-2.5 rounded-knopf border border-rahmen hover:border-rahmen transition-colors"
          >
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <span className="font-bold text-schrift">{item.name}</span>
                {typeLabel.includes('Ressourc') && item.source === 'xp' && items.some((o, j) => j !== idx && o.name === item.name)
                  && !getResolvedResources().list.find((r) => r.name === item.name)?.mehrfach ? (
                  <span data-testid="ressource-steigerung" className="bg-erhoeht border border-rahmen px-2 py-0.5 rounded-knopf text-[11px] font-bold text-schrift uppercase tracking-wider">
                    +{itemLevel} · gesamt {items.filter((o) => o.name === item.name).reduce((n, o) => n + (o.level ?? 1), 0)}
                  </span>
                ) : item.level && item.level > 1 ? (
                  <span className="bg-erhoeht border border-rahmen px-2 py-0.5 rounded-knopf text-[11px] font-bold text-schrift uppercase tracking-wider">
                    Stufe {item.level}
                  </span>
                ) : null}
                <SourceBadge
                  source={source}
                  page={page}
                  tooltipData={{ title: item.name, description }}
                />
              </div>

              {showCosts && (
                <div className="text-[11px] text-leise mt-1">
                  {item.isRacial ? (
                    <span className="text-unverletzt font-bold">Gratis: Rasse</span>
                  ) : item.pointCost === 0 ? (
                    <span className="text-unverletzt font-bold">Gratis: Heimat</span>
                  ) : item.isFree || (typeLabel.includes('Sprach') && item.source === 'creation') ? (
                    <span className="text-unverletzt font-bold">
                      Gratis{item.desc === 'Muttersprache' ? ': Muttersprache' : typeLabel.includes('Sprach') ? ' (Erschaffung)' : ''}
                    </span>
                  ) : item.source === 'creation' ? (
                    <span className="text-gold font-bold">
                      {creationCost} Pkt (Erstellung)
                      {epStufen > 0 && <span className="text-leise font-normal"> · +{epStufen} Stufe{epStufen > 1 ? 'n' : ''} für {epStufen * itemPointCost * xpMultiplier} EP</span>}
                    </span>
                  ) : item.isFree ? (
                    <span className="text-unverletzt font-bold">Gratis</span>
                  ) : (
                    <span>
                      Kosten: {xpCost} EP
                    </span>
                  )}
                </div>
              )}
            </div>
            {canDelete && (
              <Knopf
                onClick={() => onDelete(idx)}
                className="text-lg no-print shrink-0"
                title={istSchwaeche && mode !== 'creation' ? 'Ablegen (beim Erreichen eines neuen Heldengrades, GRW S. 84)' : 'Entfernen'}
              >
                ×
              </Knopf>
            )}
          </div>
        );
      })}
    </div>
  );
};
