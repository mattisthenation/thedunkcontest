const CSS = `
:root { --gold: #ffc928; --gold-dark: #b8860b; --ink: #0b0d14; --red: #e8432e;
  --font: 'Verdana','Tahoma',sans-serif; --display: 'Arial Black','Verdana',sans-serif; }
#lobby, #lobby * { box-sizing: border-box; }
#lobby { position: fixed; inset: 0; z-index: 10; overflow-y: auto; font-family: var(--font); color: #fff;
  background: radial-gradient(ellipse at 50% -10%, rgba(255,201,40,0.16), transparent 55%),
    linear-gradient(170deg, #11141f, #0b0d14 55%, #151022); }
#lobby.hidden { display: none; }
.lobbyInner { max-width: 980px; margin: 0 auto; padding: 36px 24px 48px; text-align: center; }
#lobby h1 { font-family: var(--display); font-size: 56px; line-height: 0.95; letter-spacing: 4px;
  color: var(--gold); text-shadow: 4px 4px 0 var(--red), 7px 7px 0 #000; margin: 0 0 10px; }
#lobby .tag { font-size: 11px; letter-spacing: 3px; color: #8d96ad; margin: 0 0 28px; }
.lobbyCols { display: flex; gap: 28px; justify-content: center; flex-wrap: wrap; text-align: left; }
.lobbyCol { flex: 1 1 360px; max-width: 460px; }
.lobbyCol h2 { font-family: var(--display); font-size: 14px; letter-spacing: 3px; color: #fff;
  border-bottom: 2px solid var(--gold); padding-bottom: 6px; margin: 0 0 14px; }
#nameInput { width: 100%; padding: 11px 14px; margin-bottom: 14px; font-family: var(--display);
  font-size: 16px; letter-spacing: 2px; color: var(--gold); background: #060810; border: 2px solid #2a3046;
  border-radius: 6px; outline: none; text-transform: uppercase; box-sizing: border-box; }
#nameInput:focus { border-color: var(--gold); }
.creator { display: flex; gap: 16px; }
.previewBox { flex: 0 0 200px; background: #060810; border: 2px solid #2a3046; border-radius: 8px; padding: 4px; text-align: center; }
#charPreview { image-rendering: pixelated; width: 192px; height: 256px; }
.previewBtns { display: flex; gap: 6px; padding: 4px; }
.mini { flex: 1; font-size: 10px; font-weight: bold; letter-spacing: 1px; padding: 7px 4px; background: #1a2030;
  color: #cfd6e6; border: 1px solid #38415c; border-radius: 4px; cursor: pointer; }
.mini:hover { background: #242c42; }
.knobs { flex: 1; display: flex; flex-direction: column; gap: 7px; }
.knobRow { display: flex; align-items: center; gap: 8px; }
.knobRow label { flex: 0 0 84px; font-size: 9px; font-weight: bold; letter-spacing: 1px; color: #8d96ad; }
.swatches { display: flex; gap: 4px; flex-wrap: wrap; }
.swatch { width: 20px; height: 20px; border-radius: 4px; cursor: pointer; padding: 0;
  border: 2px solid rgba(255,255,255,0.15); }
.swatch.sel { border-color: var(--gold); box-shadow: 0 0 8px rgba(255,201,40,0.6); }
.knobRow select { flex: 1; padding: 6px 10px; font-size: 11px; font-weight: bold; font-family: var(--font);
  background: #1a2030; color: #fff; border: 1px solid #38415c; border-radius: 4px; cursor: pointer; }
#numInput { width: 70px; padding: 6px 8px; font-family: var(--display); font-size: 14px; color: var(--gold);
  background: #060810; border: 2px solid #2a3046; border-radius: 4px; }
#courtGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.courtCard { display: flex; flex-direction: column; gap: 3px; padding: 12px 14px; text-align: left;
  background: #10141f; border: 2px solid #2a3046; border-radius: 8px; cursor: pointer; color: #fff;
  transition: transform .08s, border-color .08s; }
.courtCard:hover { transform: translateY(-2px); border-color: #56618a; }
.cFlag { font-size: 20px; }
.cName { font-family: var(--display); font-size: 13px; letter-spacing: 1px; color: var(--gold); }
.cLoc { font-size: 10px; letter-spacing: 1px; color: #8d96ad; }
#leaderboardMount { margin-top: 18px; }
.lbTitle { font-family: var(--display); font-size: 14px; letter-spacing: 3px; color: #fff;
  border-bottom: 2px solid var(--gold); padding-bottom: 6px; margin: 0 0 10px; }
.lbHead, .lbRow { display: flex; align-items: center; gap: 8px; padding: 4px 6px; font-size: 11px; }
.lbHead { color: #8d96ad; font-weight: bold; letter-spacing: 1px; font-size: 9px; }
.lbRow { background: #10141f; border-radius: 4px; margin-bottom: 3px; }
.lbRow.me { background: rgba(255,201,40,0.12); border: 1px solid rgba(255,201,40,0.4); }
.lbRow:nth-child(3) .lbRank { color: var(--gold); }
.lbRank { flex: 0 0 22px; color: #8d96ad; font-weight: bold; }
.lbName { flex: 1; font-weight: bold; }
.lbStat { flex: 0 0 52px; text-align: right; color: var(--gold); font-weight: bold; }
.lbStat.sm { flex: 0 0 44px; color: #b9c0d2; font-weight: normal; }
.lbEmpty { padding: 10px 6px; font-size: 11px; color: #8d96ad; }
.lbMe { margin-top: 8px; padding: 8px 10px; font-size: 10px; letter-spacing: 1px; color: var(--gold);
  background: #10141f; border-radius: 4px; border: 1px solid #2a3046; }
.lobbyActions { margin-top: 28px; display: flex; gap: 14px; justify-content: center; }
#playBtn { font-family: var(--display); font-size: 22px; letter-spacing: 4px; padding: 14px 56px; color: #0b0d14;
  background: var(--gold); border: none; border-radius: 8px; cursor: pointer;
  box-shadow: 0 5px 0 var(--gold-dark), 0 10px 24px rgba(0,0,0,0.5); transition: transform .07s, box-shadow .07s; }
#playBtn:hover { transform: translateY(2px); box-shadow: 0 3px 0 var(--gold-dark); }
#playBtn:active { transform: translateY(5px); box-shadow: 0 0 0 var(--gold-dark); }
.ghost { font-family: var(--display); font-size: 13px; letter-spacing: 2px; padding: 12px 22px; background: transparent;
  color: #8d96ad; border: 2px solid #2a3046; border-radius: 8px; cursor: pointer; }
.ghost:hover { color: #fff; border-color: #56618a; }
.courtCard.selected { border-color: var(--gold); background: #181a10; box-shadow: 0 0 14px rgba(255,201,40,0.25); }
`;

/** Inject the v3-faithful lobby stylesheet once. */
export function injectLobbyStyles(): void {
  if (document.getElementById('lobby-styles')) return;
  const el = document.createElement('style');
  el.id = 'lobby-styles';
  el.textContent = CSS;
  document.head.append(el);
}
