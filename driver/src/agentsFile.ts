/**
 * agentsFile.ts — 외부 `agents.json` 파일을 읽어 에이전트 정의로 검증·파싱한다.
 *
 * 목적: 코드를 수정하지 않고 에이전트(이름·모델·페르소나·스킬·폴백모델)를 추가/수정할 수 있게 한다.
 *       잘못된 설정은 "몇 번째 항목의 어떤 필드가 왜 틀렸는지" 한국어로 알려준다.
 * 의존성: node:fs(기본 reader). 테스트는 readFileFn 을 주입해 디스크 없이 검증.
 * 비고: 런타임 순환참조를 피하려고 config.ts 의 validateAgents 를 가져오지 않고
 *       자체적으로 검증한다(AgentDefinition 은 타입만 import → 컴파일 시 제거).
 */
import * as fs from 'node:fs';

import type { AgentDefinition } from './config.ts';

/** 한 항목(객체)을 검증해 AgentDefinition 으로 만든다. 위치(index)를 에러에 포함. */
function parseAgentEntry(item: unknown, index: number): AgentDefinition {
  const where = `agents[${index}]`;
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error(`${where} 가 객체가 아닙니다.`);
  }
  const o = item as Record<string, unknown>;

  if (typeof o.name !== 'string' || !o.name.trim()) {
    throw new Error(`${where}.name 이 비어 있거나 문자열이 아닙니다.`);
  }
  if (typeof o.model !== 'string' || !o.model.trim()) {
    throw new Error(`${where}(${o.name}).model 이 비어 있거나 문자열이 아닙니다.`);
  }

  const def: AgentDefinition = { name: o.name, model: o.model };

  if (o.persona !== undefined) {
    if (typeof o.persona !== 'string') throw new Error(`${where}(${o.name}).persona 는 문자열이어야 합니다.`);
    def.persona = o.persona;
  }
  if (o.skillFile !== undefined) {
    if (typeof o.skillFile !== 'string') throw new Error(`${where}(${o.name}).skillFile 은 문자열이어야 합니다.`);
    def.skillFile = o.skillFile;
  }
  if (o.fallbackModels !== undefined) {
    if (!Array.isArray(o.fallbackModels) || !o.fallbackModels.every((m) => typeof m === 'string')) {
      throw new Error(`${where}(${o.name}).fallbackModels 는 문자열 배열이어야 합니다.`);
    }
    def.fallbackModels = o.fallbackModels as string[];
  }
  if (o.apiKey !== undefined) {
    if (typeof o.apiKey !== 'string') throw new Error(`${where}(${o.name}).apiKey 는 문자열이어야 합니다.`);
    def.apiKey = o.apiKey;
  }

  return def;
}

/**
 * agents.json 을 읽어 검증된 AgentDefinition[] 로 반환한다.
 * 입력: filePath, (선택) readFileFn — 기본 fs.readFileSync(utf8)
 * 출력: AgentDefinition[]
 * 허용 형태: 최상위가 배열, 또는 { "agents": [...] }.
 * 예외: 읽기 실패 / JSON 깨짐 / 형태 오류 / 필드 오류 / 이름 중복 → 한국어 에러.
 */
export function loadAgentsFile(
  filePath: string,
  readFileFn: (p: string) => string = (p) => fs.readFileSync(p, 'utf8'),
): AgentDefinition[] {
  let raw: string;
  try {
    raw = readFileFn(filePath);
  } catch {
    throw new Error(`에이전트 설정 파일을 읽을 수 없습니다 (${filePath}).`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`에이전트 설정 파일이 올바른 JSON 이 아닙니다 (${filePath}).`);
  }

  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { agents?: unknown }).agents)
      ? ((parsed as { agents: unknown[] }).agents)
      : null;

  if (!list) {
    throw new Error(`에이전트 설정은 배열이거나 { "agents": [...] } 형태여야 합니다 (${filePath}).`);
  }
  if (list.length === 0) {
    throw new Error(`에이전트 설정에 에이전트가 하나도 없습니다 (${filePath}).`);
  }

  const defs = list.map((item, i) => parseAgentEntry(item, i));

  // 이름 중복 검사(자체 수행 — config 와 순환참조 방지).
  const seen = new Set<string>();
  for (let i = 0; i < defs.length; i++) {
    const name = defs[i].name;
    if (seen.has(name)) throw new Error(`에이전트 이름이 중복됩니다: ${name} (agents[${i}])`);
    seen.add(name);
  }

  return defs;
}
