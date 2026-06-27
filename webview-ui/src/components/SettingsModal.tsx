import { useState } from 'react';

import { type Lang,t } from '../i18n.js';
import { isSoundEnabled, setSoundEnabled } from '../notificationSound.js';
import { transport } from '../transport/index.js';
import { Button } from './ui/Button.js';
import { Checkbox } from './ui/Checkbox.js';
import { MenuItem } from './ui/MenuItem.js';
import { Modal } from './ui/Modal.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDebugMode: boolean;
  onToggleDebugMode: () => void;
  alwaysShowOverlay: boolean;
  onToggleAlwaysShowOverlay: () => void;
  externalAssetDirectories: string[];
  watchAllSessions: boolean;
  onToggleWatchAllSessions: () => void;
  hooksEnabled: boolean;
  onToggleHooksEnabled: () => void;
  /** F5: 현재 떠 있는 에이전트 id 목록. */
  agents: number[];
  /** F5: 에이전트별 현재 모델(id→model). */
  agentModels: Record<number, string>;
  /** F5: 선택 가능한 모델 목록(드라이버 보고). 비어 있으면 섹션 숨김. */
  availableModels: string[];
  /** F5: 모델 변경 요청. */
  onSetAgentModel: (id: number, model: string) => void;
  /** F6: 현재 UI 언어. */
  lang: Lang;
  /** F6: 언어 토글(ko↔en). */
  onToggleLanguage: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  isDebugMode,
  onToggleDebugMode,
  alwaysShowOverlay,
  onToggleAlwaysShowOverlay,
  externalAssetDirectories,
  watchAllSessions,
  onToggleWatchAllSessions,
  hooksEnabled,
  onToggleHooksEnabled,
  agents,
  agentModels,
  availableModels,
  onSetAgentModel,
  lang,
  onToggleLanguage,
}: SettingsModalProps) {
  const [soundLocal, setSoundLocal] = useState(isSoundEnabled);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('settings', lang)}>
      <MenuItem
        onClick={() => {
          transport.send({ type: 'openSessionsFolder' });
          onClose();
        }}
      >
        {t('openSessionsFolder', lang)}
      </MenuItem>
      <MenuItem
        onClick={() => {
          transport.send({ type: 'exportLayout' });
          onClose();
        }}
      >
        {t('exportLayout', lang)}
      </MenuItem>
      <MenuItem
        onClick={() => {
          transport.send({ type: 'importLayout' });
          onClose();
        }}
      >
        {t('importLayout', lang)}
      </MenuItem>
      <MenuItem
        onClick={() => {
          transport.send({ type: 'addExternalAssetDirectory' });
          onClose();
        }}
      >
        {t('addAssetDirectory', lang)}
      </MenuItem>
      {externalAssetDirectories.map((dir) => (
        <div key={dir} className="flex items-center justify-between py-4 px-10 gap-8">
          <span
            className="text-xs text-text-muted overflow-hidden text-ellipsis whitespace-nowrap"
            title={dir}
          >
            {dir.split(/[/\\]/).pop() ?? dir}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => transport.send({ type: 'removeExternalAssetDirectory', path: dir })}
            className="shrink-0"
          >
            x
          </Button>
        </div>
      ))}
      <Checkbox label={t('language', lang)} checked={lang === 'ko'} onChange={onToggleLanguage} />
      <Checkbox
        label={t('soundNotifications', lang)}
        checked={soundLocal}
        onChange={() => {
          const newVal = !isSoundEnabled();
          setSoundEnabled(newVal);
          setSoundLocal(newVal);
          transport.send({ type: 'setSoundEnabled', enabled: newVal });
        }}
      />
      <Checkbox
        label={t('watchAllSessions', lang)}
        checked={watchAllSessions}
        onChange={onToggleWatchAllSessions}
      />
      <Checkbox
        label={t('instantDetection', lang)}
        checked={hooksEnabled}
        onChange={onToggleHooksEnabled}
      />
      <Checkbox
        label={t('alwaysShowLabels', lang)}
        checked={alwaysShowOverlay}
        onChange={onToggleAlwaysShowOverlay}
      />
      <Checkbox label={t('debugView', lang)} checked={isDebugMode} onChange={onToggleDebugMode} />

      {/* F5: 에이전트별 모델 선택(드라이버가 모델을 보고했을 때만 표시) */}
      {availableModels.length > 0 && agents.length > 0 && (
        <div className="py-4 px-10">
          <div className="text-sm text-text mb-4">{t('agentModels', lang)}</div>
          {agents.map((id) => {
            const current = agentModels[id] ?? '';
            const options =
              current && !availableModels.includes(current)
                ? [current, ...availableModels]
                : availableModels;
            return (
              <div key={id} className="flex items-center justify-between py-2 gap-8">
                <span className="text-xs text-text-muted whitespace-nowrap">Agent #{id}</span>
                <select
                  className="text-xs bg-bg text-text border-2 border-border rounded-none px-4 py-2 max-w-[60%] overflow-hidden text-ellipsis"
                  value={current}
                  onChange={(e) => onSetAgentModel(id, e.target.value)}
                  data-testid={`agent-model-${id}`}
                >
                  {options.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
