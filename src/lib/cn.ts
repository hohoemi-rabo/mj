// Tailwind クラスの結合ユーティリティ。
// clsx で条件付き結合 → tailwind-merge で競合クラス（例 px-4 と px-8）の後勝ちを解決する。
// className での上書きを安全にするため、共通UIコンポーネント全体で使う。

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
