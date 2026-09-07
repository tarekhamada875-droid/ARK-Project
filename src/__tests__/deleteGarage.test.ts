import { describe, it, expect, vi, beforeEach } from 'vitest';
import { firestoreService } from '../services';
import { getDocs } from 'firebase/firestore';

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual as any,
    doc: vi.fn((_db, collection, id) => ({ id, collection })),
    collection: vi.fn((_db, name) => name),
    query: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    serverTimestamp: vi.fn(() => 'server_time'),
    getCountFromServer: vi.fn(() => Promise.resolve({ data: () => ({ count: 1 }) })),
    getDocs: vi.fn(() => {
      return Promise.resolve({
        empty: false,
        size: 1,
        docs: [{ ref: { id: 'doc1' } }]
      });
    }),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    writeBatch: vi.fn(() => ({
      delete: vi.fn(),
      update: vi.fn(),
      commit: vi.fn(() => Promise.resolve())
    }))
  };
});

describe('v167 - Garage Deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. should delete garage and handle sources properly', async () => {
    let mockGetDocsCallCount = 0;
    (getDocs as any).mockImplementation(() => {
      mockGetDocsCallCount++;
      // Return empty after first call for each query to avoid infinite loop
      if (mockGetDocsCallCount > 13) {
         return Promise.resolve({ empty: true, size: 0, docs: [] });
      }
      return Promise.resolve({
        empty: false,
        size: 1,
        docs: [{ ref: { id: 'doc1' } }]
      });
    });

    const progressLog: any[] = [];
    await firestoreService.deleteGarage('test_garage', (progress) => {
      progressLog.push(progress);
    });

    expect(progressLog.length).toBeGreaterThan(0);
    expect(progressLog[progressLog.length - 1].percentage).toBe(100);
    expect(progressLog[progressLog.length - 1].phase).toBe('complete');
  });
});
