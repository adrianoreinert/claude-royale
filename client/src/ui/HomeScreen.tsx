import { useEffect, useState } from 'react';
import { getCard, type BotDifficulty } from '@claude-royale/shared';
import { fetchLeaderboard, type JoinBattleOptions } from '../net/connection';
import { ARENA_PALETTES, isArenaTheme, type ArenaTheme } from '../game/arena';
import { useI18n } from '../i18n';
import { CardArt } from './CardArt';
import { CollectionScreen } from './CollectionScreen';
import { DeckScreen } from './DeckScreen';
import { ProfileScreen } from './ProfileScreen';
import { PremiumScreen } from './PremiumScreen';
import { currentArena, nextArena } from './achievements';
import type { Profile } from './profileStorage';

type Tab = 'batalha' | 'colecao' | 'deck' | 'perfil' | 'passe';
type PlayOptions = Omit<JoinBattleOptions, 'deck' | 'name' | 'cardLevels'>;

interface HomeScreenProps {
  connecting: boolean;
  deck: string[];
  profile: Profile;
  theme: ArenaTheme;
  onThemeChange: (theme: ArenaTheme) => void;
  onNameChange: (name: string) => void;
  onDeckChange: (deck: string[]) => void;
  onUpgradeCard: (cardId: string) => void;
  onRegister: (name: string) => void;
  onPlay: (opts: PlayOptions) => void;
  onSpectate: (code: string) => void;
}

const TABS: Array<{ id: Tab; icon: string }> = [
  { id: 'colecao', icon: '🃏' },
  { id: 'deck', icon: '🛡️' },
  { id: 'batalha', icon: '⚔️' },
  { id: 'passe', icon: '👑' },
  { id: 'perfil', icon: '👤' },
];

export function HomeScreen({
  connecting, deck, profile, theme, onThemeChange, onNameChange, onDeckChange,
  onUpgradeCard, onRegister, onPlay, onSpectate,
}: HomeScreenProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('batalha');
  const arena = currentArena(profile.trophies);

  return (
    <div className="home-screen">
      {!profile.registered && <OnboardingModal onRegister={onRegister} />}
      <header className="home-header">
        <div className="profile-plate">
          <span className="header-emblem">{arena.emoji}</span>
          <div className="header-identity">
            <input
              className="profile-name"
              value={profile.name}
              maxLength={16}
              onChange={(e) => onNameChange(e.target.value)}
              aria-label={t('home.playerName')}
            />
            <div className="header-xp">
              <div
                className="header-xp-fill"
                style={{ width: `${Math.min(100, (profile.trophies % 100))}%` }}
              />
            </div>
          </div>
          <span className="header-badge">{profile.trophies}</span>
        </div>
        <div className="currency-bar">
          <span className="currency">🏆 {profile.trophies}</span>
          <span className="currency">🪙 {profile.gold}</span>
          <span className="currency dim">💎 0</span>
          <button className="icon-button small" onClick={() => setTab('perfil')} aria-label={t('common.settings')}>
            ⚙️
          </button>
        </div>
      </header>

      <div className="home-content">
        {tab === 'batalha' && (
          <BattleTab
            connecting={connecting}
            deck={deck}
            profile={profile}
            theme={theme}
            onThemeChange={onThemeChange}
            onPlay={onPlay}
            onSpectate={onSpectate}
          />
        )}
        {tab === 'colecao' && <CollectionScreen profile={profile} onUpgradeCard={onUpgradeCard} />}
        {tab === 'deck' && <DeckScreen deck={deck} onDeckChange={onDeckChange} />}
        {tab === 'perfil' && <ProfileScreen profile={profile} onNameChange={onNameChange} />}
        {tab === 'passe' && <PremiumScreen />}
      </div>

      <nav className="tab-bar" aria-label={t('home.mainNav')}>
        {TABS.map(({ id, icon }) => (
          <button
            key={id}
            className={`tab-button ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            <span className="tab-icon">{icon}</span>
            <span className="tab-label">{t(`tabs.${id}`)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

interface BattleTabProps {
  connecting: boolean;
  deck: string[];
  profile: Profile;
  theme: ArenaTheme;
  onThemeChange: (theme: ArenaTheme) => void;
  onPlay: (opts: PlayOptions) => void;
  onSpectate: (code: string) => void;
}

const DIFFICULTIES: BotDifficulty[] = ['easy', 'medium', 'hard'];

function generateFriendCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join('');
}

function BattleTab({
  connecting, deck, profile, theme, onThemeChange, onPlay, onSpectate,
}: BattleTabProps) {
  const { t } = useI18n();
  const [difficulty, setDifficulty] = useState<BotDifficulty>('medium');
  const [friendCode, setFriendCode] = useState('');
  const [partyMode, setPartyMode] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Array<{ name: string; trophies: number }>>([]);

  useEffect(() => {
    fetchLeaderboard().then(setLeaderboard).catch(() => undefined);
  }, []);

  const mode = partyMode ? ('party' as const) : ('' as const);
  const normalizedCode = friendCode.trim().toUpperCase();
  const arena = currentArena(profile.trophies);
  const next = nextArena(profile.trophies);
  const arenaSpan = next ? next.minTrophies - arena.minTrophies : 1;
  const arenaProgress = next
    ? Math.min(100, Math.round(((profile.trophies - arena.minTrophies) / arenaSpan) * 100))
    : 100;

  return (
    <div className="battle-dashboard">
      <div className="dashboard-grid">
        <aside className="dash-panel slide-left">
          <h3 className="dash-title">{t('home.ranking')}</h3>
          <div className="rank-emblem-wrap">
            <img className="rank-emblem" src="/assets/ui/crest-gold.png" alt="" />
            <span className="rank-arena-emoji">{arena.emoji}</span>
          </div>
          <p className="rank-name">{arena.name}</p>
          <div className="rank-progress" role="progressbar" aria-valuenow={arenaProgress} aria-valuemin={0} aria-valuemax={100}>
            <div className="rank-progress-fill" style={{ width: `${arenaProgress}%` }} />
          </div>
          <p className="rank-progress-label">
            {next
              ? t('home.arenaProgress', { trophies: profile.trophies, min: next.minTrophies, emoji: next.emoji, name: next.name })
              : t('home.arenaMax')}
          </p>
          {leaderboard.length > 0 && (
            <ul className="dash-list">
              {leaderboard.slice(0, 4).map((row, i) => (
                <li key={row.name} className="dash-row">
                  <span className="dash-row-main">{['🥇', '🥈', '🥉', '4º'][i]} {row.name}</span>
                  <span className="dash-row-side">🏆 {row.trophies}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="dash-center">
          <img className="menu-logo" src="/logo.png" alt="Claude Royale" />
          <div className="deck-ready">{t('home.deckReady')}</div>
          <button className="battle-cta" onClick={() => onPlay({})} disabled={connecting}>
            <span className="battle-cta-shine" aria-hidden="true" />
            {connecting ? t('common.connecting') : t('common.battle')}
          </button>
          <div className="dash-secondary">
            <button
              className="play-button secondary"
              onClick={() => onPlay({ vsBot: true, botDifficulty: difficulty, mode })}
              disabled={connecting}
            >
              {t('home.trainVsBot')}
            </button>
            <button
              className="play-button secondary"
              disabled={connecting}
              onClick={() => {
                const code = normalizedCode || generateFriendCode();
                setFriendCode(code);
                onPlay({ privateCode: code });
              }}
            >
              {t('home.playWithFriend')}
            </button>
          </div>
          <div className="difficulty-picker" role="radiogroup" aria-label={t('home.botDifficulty')}>
            {DIFFICULTIES.map((id) => (
              <button
                key={id}
                className={`difficulty-option ${difficulty === id ? 'active' : ''}`}
                onClick={() => setDifficulty(id)}
              >
                {t(`diff.${id}`)}
              </button>
            ))}
          </div>

          <details className="more-options">
            <summary>{t('home.moreOptions')}</summary>
            <div className="friend-row">
              <input
                className="code-input"
                placeholder={t('home.code')}
                maxLength={6}
                value={friendCode}
                onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
              />
              <button
                className="text-button"
                disabled={connecting || normalizedCode.length < 4}
                onClick={() => onSpectate(normalizedCode)}
              >
                {t('home.watch')}
              </button>
              <button
                className="text-button"
                disabled={connecting}
                onClick={() => onPlay({ botMatch: true, botDifficulty: difficulty })}
              >
                {t('home.watchBots')}
              </button>
            </div>
            <label className={`party-toggle ${partyMode ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={partyMode}
                onChange={(e) => setPartyMode(e.target.checked)}
              />
              {t('home.infiniteElixir')}
            </label>
            <div className="theme-picker" role="radiogroup" aria-label={t('home.arenaTheme')}>
              {(Object.keys(ARENA_PALETTES) as ArenaTheme[]).map((id) => (
                <button
                  key={id}
                  className={`difficulty-option ${theme === id ? 'active' : ''}`}
                  onClick={() => isArenaTheme(id) && onThemeChange(id)}
                >
                  {t(`theme.${id}`)}
                </button>
              ))}
            </div>
            <p className="menu-hint">{t('home.hint')}</p>
          </details>
        </section>

        <aside className="dash-panel slide-right">
          <h3 className="dash-title">{t('home.recentMatches')}</h3>
          {profile.history.length === 0 ? (
            <p className="dash-empty">{t('home.noMatches')}</p>
          ) : (
            <ul className="dash-list">
              {profile.history.slice(0, 6).map((match, i) => (
                <li key={i} className={`dash-row ${match.result}`}>
                  <span className="dash-row-main">
                    {match.result === 'win' ? `✅ ${t('common.win')}` : match.result === 'loss' ? `❌ ${t('common.loss')}` : `🤝 ${t('common.draw')}`}
                  </span>
                  <span className="dash-row-side">
                    {match.myCrowns} 👑 {match.oppCrowns} · {match.vsBot ? '🤖' : '⚔️'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="dash-footnote">{t('home.botNoTrophies')}</p>
        </aside>
      </div>

      <div className="deck-strip">
        {deck.map((cardId) => {
          const card = getCard(cardId);
          if (!card) return null;
          return (
            <div key={cardId} className="deck-preview-card" title={card.name}>
              <CardArt cardId={cardId} color="blue" emoji={card.emoji} />
              <span className="strip-cost">{card.cost}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Cadastro no primeiro acesso: escolhe o nome de batalha. */
function OnboardingModal({ onRegister }: { onRegister: (name: string) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const valid = name.trim().length >= 2;
  return (
    <div className="modal-backdrop onboarding">
      <div className="modal-card onboarding-card">
        <img className="onboarding-logo" src="/logo.png" alt="Claude Royale" />
        <h3>{t('home.createProfile')}</h3>
        <p className="modal-type">{t('home.chooseName')}</p>
        <input
          className="code-input name-input"
          placeholder={t('home.yourName')}
          maxLength={16}
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && valid && onRegister(name.trim())}
        />
        <button
          className="play-button"
          disabled={!valid}
          onClick={() => onRegister(name.trim())}
        >
          {t('home.start')}
        </button>
      </div>
    </div>
  );
}
