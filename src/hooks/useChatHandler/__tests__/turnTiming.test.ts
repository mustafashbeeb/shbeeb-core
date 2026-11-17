jest.mock('@/utils/constants', () => ({ generateUUID: () => 'node-id' }));
jest.mock('@/i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }));
import AssistantTurn from '../turn';
test('reports wall time separately from generation and ignores hidden reasoning for first answer', () => {
  let clock = 1000;
  const now = jest.spyOn(Date, 'now').mockImplementation(() => clock);
  try {
    const turn = new AssistantTurn({ uuid: 'chat-id' } as any);
    clock = 1500;
    turn.applyEvent('chunk', '<think>thinking</think>');
    expect(turn.snapshot().response.textResponse).toBe('');
    clock = 2000;
    turn.applyEvent('chunk', '56');
    expect(turn.snapshot().response.textResponse).toBe('56');
    turn.applyEvent('report_metrics', { duration: 10, total_tokens: 5, prompt_tokens: 3, completion_tokens: 2, outputTps: 20 });
    clock = 2200;
    turn.applyEvent('complete', '');
    expect(turn.response.metrics).toMatchObject({ elapsedMs: 1200, firstAnswerMs: 1000, duration: 10 });
  } finally { now.mockRestore(); }
});
test('empty answer never invents a first-answer time', () => {
  const turn = new AssistantTurn({ uuid: 'empty' } as any);
  turn.applyEvent('complete', '');
  expect(turn.response.metrics.firstAnswerMs).toBeUndefined();
  expect(turn.response.metrics.elapsedMs).toBeGreaterThanOrEqual(0);
});
