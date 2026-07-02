export interface CourtCard {
  id: string;
  name: string;
  location: string;
  flag: string;
}

/** The 6 v3 courts (ported from thedunkcontest/shared/courts.js). Reserved for Phase B; disabled in A2b. */
export const COURTS: CourtCard[] = [
  { id: 'rucker', name: 'The Cage', location: 'New York City', flag: '🇺🇸' },
  { id: 'venice', name: 'Venice Beach', location: 'Los Angeles', flag: '🇺🇸' },
  { id: 'tokyo', name: 'Shibuya Rooftop', location: 'Tokyo', flag: '🇯🇵' },
  { id: 'rio', name: 'Favela Heights', location: 'Rio de Janeiro', flag: '🇧🇷' },
  { id: 'paris', name: 'Le Toit', location: 'Paris', flag: '🇫🇷' },
  { id: 'tundra', name: 'Polar Run', location: 'Tromsø', flag: '🇳🇴' },
];

export interface CourtGrid { getSelected(): string; }

export function renderCourtGrid(mount: HTMLElement): CourtGrid {
  let selected = COURTS[0].id;
  const paint = () => {
    mount.innerHTML = COURTS.map((c) => `
      <button class="courtCard${c.id === selected ? ' selected' : ''}" data-id="${c.id}">
        <span class="cFlag">${c.flag}</span>
        <span class="cName">${c.name}</span>
        <span class="cLoc">${c.location}</span>
      </button>`).join('');
    for (const btn of Array.from(mount.querySelectorAll<HTMLButtonElement>('.courtCard'))) {
      btn.addEventListener('click', () => { selected = btn.dataset.id as string; paint(); });
    }
  };
  paint();
  return { getSelected: () => selected };
}
