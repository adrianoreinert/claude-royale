import { useState } from 'react';
import { ACHIEVEMENTS, ARENAS, currentArena, nextArena } from './achievements';
import { loadSettings, saveSettings } from './settings';
import type { Profile } from './profileStorage';

interface ProfileScreenProps {
  profile: Profile;
  onNameChange: (name: string) => void;
}

/** Aba Perfil: identidade, caminho dos troféus, estatísticas, conquistas e histórico. */
export function ProfileScreen({ profile, onNameChange }: ProfileScreenProps) {
  const arena = currentArena(profile.trophies);
  const next = nextArena(profile.trophies);
  const winrate =
    profile.stats.matches > 0
      ? Math.round((profile.stats.wins / profile.stats.matches) * 100)
      : 0;
  const unlockedCount = Object.keys(profile.achievements).length;

  return (
    <div className="profile-screen">
      <h2 className="screen-title">Perfil</h2>

      <div className="profile-card">
        <div className="profile-avatar">{arena.emoji}</div>
        <div className="profile-identity">
          <input
            className="profile-name big"
            value={profile.name}
            maxLength={16}
            onChange={(e) => onNameChange(e.target.value)}
            aria-label="Nome do jogador"
          />
          <p className="profile-arena">
            {arena.emoji} {arena.name} · 🏆 {profile.trophies} · 💰 {profile.gold}
          </p>
        </div>
      </div>

      <h3 className="section-title">🛤️ Caminho dos Troféus</h3>
      <div className="trophy-road">
        {ARENAS.map((step) => {
          const reached = profile.trophies >= step.minTrophies;
          const isCurrent = step.name === arena.name;
          return (
            <div
              key={step.name}
              className={`road-step ${reached ? 'reached' : ''} ${isCurrent ? 'current' : ''}`}
            >
              <span className="road-emoji">{step.emoji}</span>
              <span className="road-name">{step.name}</span>
              <span className="road-trophies">🏆 {step.minTrophies}</span>
            </div>
          );
        })}
      </div>
      {next && (
        <p className="deck-hint">
          Faltam <strong>{next.minTrophies - profile.trophies}</strong> troféus para{' '}
          {next.emoji} {next.name}
        </p>
      )}

      <h3 className="section-title">📊 Estatísticas</h3>
      <div className="stats-grid">
        <Stat label="Partidas" value={profile.stats.matches} />
        <Stat label="Vitórias" value={profile.stats.wins} />
        <Stat label="Derrotas" value={profile.stats.losses} />
        <Stat label="Empates" value={profile.stats.draws} />
        <Stat label="Winrate" value={`${winrate}%`} />
        <Stat label="Coroas" value={profile.stats.crowns} />
      </div>

      <h3 className="section-title">
        🏅 Conquistas ({unlockedCount}/{ACHIEVEMENTS.length})
      </h3>
      <div className="achievements-grid">
        {ACHIEVEMENTS.map((achievement) => {
          const unlockedAt = profile.achievements[achievement.id];
          return (
            <div
              key={achievement.id}
              className={`achievement ${unlockedAt ? 'unlocked' : 'locked'}`}
              title={achievement.description}
            >
              <span className="achievement-emoji">{unlockedAt ? achievement.emoji : '🔒'}</span>
              <span className="achievement-name">{achievement.name}</span>
              <span className="achievement-desc">{achievement.description}</span>
              {unlockedAt && (
                <span className="achievement-date">{unlockedAt.slice(0, 10)}</span>
              )}
            </div>
          );
        })}
      </div>

      <SettingsPanel />

      {profile.history.length > 0 && (
        <>
          <h3 className="section-title">🕘 Últimas partidas</h3>
          <div className="match-history full">
            <ul>
              {profile.history.map((match, i) => (
                <li key={i} className={`history-row ${match.result}`}>
                  <span className="history-result">
                    {match.result === 'win' ? '✅ Vitória' : match.result === 'loss' ? '❌ Derrota' : '🤝 Empate'}
                  </span>
                  <span className="history-score">
                    {match.myCrowns} 👑 {match.oppCrowns}
                  </span>
                  <span className="history-mode">{match.vsBot ? '🤖 bot' : '⚔️ 1v1'}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

/** Acessibilidade e conforto. */
function SettingsPanel() {
  const [settings, setSettings] = useState(loadSettings);
  const update = (patch: Partial<ReturnType<typeof loadSettings>>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };
  return (
    <>
      <h3 className="section-title">⚙️ Configurações</h3>
      <div className="mode-row settings-row">
        <label className={`party-toggle ${settings.reduceEffects ? 'on' : ''}`}>
          <input
            type="checkbox"
            checked={settings.reduceEffects}
            onChange={(e) => update({ reduceEffects: e.target.checked })}
          />
          🍃 Reduzir efeitos (clima/luzes)
        </label>
        <label className={`party-toggle ${settings.colorblind ? 'on' : ''}`}>
          <input
            type="checkbox"
            checked={settings.colorblind}
            onChange={(e) => update({ colorblind: e.target.checked })}
          />
          👁️ Marcadores de time (●/▲)
        </label>
        <div className="difficulty-picker">
          {[1, 1.15, 1.3].map((scale) => (
            <button
              key={scale}
              className={`difficulty-option ${settings.fontScale === scale ? 'active' : ''}`}
              onClick={() => update({ fontScale: scale })}
            >
              A{scale > 1 ? (scale > 1.2 ? '++' : '+') : ''}
            </button>
          ))}
        </div>
      </div>
      <p className="deck-hint">As opções valem a partir da próxima batalha.</p>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-value">{value}</span>
      <span className="stat-tile-label">{label}</span>
    </div>
  );
}
