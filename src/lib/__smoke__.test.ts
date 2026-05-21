import { describe, it, expect } from 'vitest'
import { smoke } from '@/lib/__smoke__'

// 暫定スモークテスト：テストハーネスと `@/*` エイリアス解決の確認用。
// src/lib/mahjong の実ロジックのテストが入ったら __smoke__.* ごと削除する（docs/02 以降）。
describe('test harness', () => {
  it('runs and resolves the @/ alias', () => {
    expect(smoke()).toBe(2)
  })
})
