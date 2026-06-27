import { describe, it, expect } from 'vitest';
import { DEFAULT_AGENTS, validateAgents, loadDriverConfig } from '../src/config.ts';

// config.ts: 에이전트 정의 + 환경변수 기반 드라이버 설정 로드/검증.
describe('config', () => {
  it('DEFAULT_AGENTS 는 3명이고 이름이 유일하며 각자 다른 모델을 쓴다', () => {
    expect(DEFAULT_AGENTS).toHaveLength(3);
    const names = DEFAULT_AGENTS.map((a) => a.name);
    const models = DEFAULT_AGENTS.map((a) => a.model);
    expect(new Set(names).size).toBe(3);
    expect(new Set(models).size).toBe(3); // 최종 완료 기준: 에이전트마다 다른 모델
  });

  it('validateAgents 는 이름 중복을 거부한다', () => {
    expect(() =>
      validateAgents([
        { name: '김', model: 'm1' },
        { name: '김', model: 'm2' },
      ]),
    ).toThrow(/중복/);
  });

  it('validateAgents 는 빈 model 을 거부한다', () => {
    expect(() => validateAgents([{ name: '김', model: '' }])).toThrow(/model/);
  });

  it('loadDriverConfig 는 키가 있으면 설정을 만든다', () => {
    const cfg = loadDriverConfig({
      OPENROUTER_API_KEY: 'sk-or-x',
      PIXEL_WORKSPACE: '/ws',
      PIXEL_LOOP_INTERVAL_MS: '6000',
    });
    expect(cfg.apiKey).toBe('sk-or-x');
    expect(cfg.workspace).toBe('/ws');
    expect(cfg.loopIntervalMs).toBe(6000);
    expect(cfg.agents).toHaveLength(3);
  });

  it('loadDriverConfig 는 키가 없으면 한국어 안내 에러를 던진다', () => {
    expect(() => loadDriverConfig({})).toThrow(/OPENROUTER_API_KEY/);
  });

  it('PIXEL_LOOP_INTERVAL_MS 가 잘못되면 기본값(4000)으로 폴백한다', () => {
    const cfg = loadDriverConfig({ OPENROUTER_API_KEY: 'k', PIXEL_WORKSPACE: '/ws', PIXEL_LOOP_INTERVAL_MS: 'abc' });
    expect(cfg.loopIntervalMs).toBe(4000);
  });

  it('백오프/동시성 환경변수를 파싱하고 기본값을 제공한다', () => {
    const def = loadDriverConfig({ OPENROUTER_API_KEY: 'k', PIXEL_WORKSPACE: '/ws' });
    expect(def.backoffBaseMs).toBe(2000);
    expect(def.backoffMaxMs).toBe(30000);
    expect(def.maxConcurrency).toBe(2);

    const custom = loadDriverConfig({
      OPENROUTER_API_KEY: 'k',
      PIXEL_WORKSPACE: '/ws',
      PIXEL_BACKOFF_BASE_MS: '500',
      PIXEL_BACKOFF_MAX_MS: '9000',
      PIXEL_MAX_CONCURRENCY: '3',
    });
    expect(custom.backoffBaseMs).toBe(500);
    expect(custom.backoffMaxMs).toBe(9000);
    expect(custom.maxConcurrency).toBe(3);
  });

  it('loopIntervalMs 는 최소값(1000)으로 클램프된다 (비용 보호)', () => {
    const cfg = loadDriverConfig({ OPENROUTER_API_KEY: 'k', PIXEL_WORKSPACE: '/ws', PIXEL_LOOP_INTERVAL_MS: '100' });
    expect(cfg.loopIntervalMs).toBe(1000);
  });

  // ── F1: agents.json 외부화 ──
  it('PIXEL_AGENTS_FILE 가 지정되면 그 파일을 로드한다(주입)', () => {
    const fileAgents = [{ name: '외부김', model: 'mx' }];
    const cfg = loadDriverConfig(
      { OPENROUTER_API_KEY: 'k', PIXEL_WORKSPACE: '/ws', PIXEL_AGENTS_FILE: '/some/agents.json' },
      undefined,
      { loadAgentsFile: () => fileAgents },
    );
    expect(cfg.agents).toEqual(fileAgents);
  });

  it('미지정이라도 기본 경로에 agents.json 이 있으면 로드한다', () => {
    const fileAgents = [{ name: '기본경로', model: 'm' }];
    const cfg = loadDriverConfig(
      { OPENROUTER_API_KEY: 'k', PIXEL_WORKSPACE: '/ws' },
      undefined,
      { fileExists: () => true, loadAgentsFile: () => fileAgents },
    );
    expect(cfg.agents).toEqual(fileAgents);
  });

  it('파일이 없으면 DEFAULT_AGENTS 로 폴백한다(기존 동작 보존)', () => {
    const cfg = loadDriverConfig(
      { OPENROUTER_API_KEY: 'k', PIXEL_WORKSPACE: '/ws' },
      undefined,
      { fileExists: () => false },
    );
    expect(cfg.agents).toHaveLength(3);
  });
});

describe('config - 언어(F6)', () => {
  it('PIXEL_LANG=en 이면 en, 미설정이면 ko', () => {
    const en = loadDriverConfig({ OPENROUTER_API_KEY: 'k', PIXEL_WORKSPACE: '/ws', PIXEL_LANG: 'en' });
    expect(en.lang).toBe('en');
    const def = loadDriverConfig({ OPENROUTER_API_KEY: 'k', PIXEL_WORKSPACE: '/ws' });
    expect(def.lang).toBe('ko');
  });
});
