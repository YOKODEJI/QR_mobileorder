"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import { fetchMenuPopularity } from "@/lib/data";
import { popularityFromOrders } from "@/lib/handy";

/** 店全体の人気（品目id→杯数）。画面を開いたときに1回だけ取る。
 *  注文のたびに並びが変わると、押そうとした品が指の下で動いてしまうため、開いている間は固定する。 */
export function useMenuPopularity(): Record<string, number> {
  const [pop, setPop] = useState<Record<string, number>>(() =>
    isSupabaseConfigured() ? {} : popularityFromOrders(useAppStore.getState().orders)
  );
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let alive = true;
    fetchMenuPopularity().then((p) => {
      if (alive && p) setPop(p);
    });
    return () => {
      alive = false;
    };
  }, []);
  return pop;
}
