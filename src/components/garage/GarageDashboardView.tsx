import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LogOut,
  Car,
  X as XIcon,
  Users,
  Zap,
  PieChart,
  Sliders,
  AlertTriangle,
  Gift,
  Clock,
  Crown,
  Megaphone,
  Sparkles,
} from "lucide-react";
import { Announcement } from "../../types";
import { FlipNumber } from "../ui/FlipNumber";
import { AnimatedCounter } from "../AnimatedCounter";
import { useTheme } from "../../utils/ThemeContext";
import { resolveShimmerColor, isLightColor, getRemainingDays, safeDate, getEffectiveDailyCapacity, isUnlimitedCapacity, isSubscriptionExpired } from "../../utils";
import { soundManager } from "../../utils/sounds";
import { auth } from "../../firebase";
import { firestoreServiceV2 as firestoreService } from "../../services/domain/firestoreServiceV2";
import { getCairoDateKey } from '../../domain/garage/businessDay';
import { RegistrationCard } from "./RegistrationCard";
import { VehicleItem } from "./VehicleItem";
import { SubscribersView } from "./SubscribersView";
import { GarageReportsView } from "./GarageReportsView";
import { RechargeHistoryView } from "./RechargeHistoryView";
import { PackagesModal } from "../modals/PackagesModal";
import { RewardsModal } from "../modals/RewardsModal";
import { StaffStatsModal } from "../modals/StaffStatsModal";
import { AppearanceSettingsModal } from "../modals/AppearanceSettingsModal";
import { MovingBalanceArrows } from "./MovingBalanceArrows";
import { BorderShimmer } from "./BorderShimmer";

// Helper functions (mapped to actual modules)
const uo = resolveShimmerColor;
const ur = isLightColor;
const pt = safeDate;
const Ac = getRemainingDays;
const Qt = auth;
const me = firestoreService;
const Rn = soundManager;

export const GarageDashboardView = memo((props: any) => {
  const {
    garage: t,
    currentStaff: e,
    isInputFocused: s,
    now: a,
    vehicles: l,
    todayTransactions: c,
    setSelectedVehicle: d,
    setShowCheckOutModal: h,
    closeKeyboard: m,
    newPlateNumber: x,
    setNewPlateNumber: b,
    setIsInputFocused: y,
    plateInputRef: k,
    handleCheckIn: T,
    inputRef: D,
    onLogout: E,
    showToast: V,
    packages: F,
    staffList: q,
    showPackages: Y,
    setShowPackages: Q,
    showStaffStats: ce,
    setShowStaffStats: te,
    showSubscribers: R,
    setShowSubscribers: j,
    walletNumber: I = "015 - 524 - 113 - 23",
    subscriptionPrices: A,
  } = props;
  const [_, O] = useState(!1),
    { theme: P } = useTheme(),
    we = uo(t == null ? void 0 : t.shimmerColor, P),
    [ie, H] = useState("main"),
    [W, ke] = useState(15),
    [ve, Se] = useState(0),
    [z, X] = useState(!1),
    [ue, Te] = useState(!1),
    [Re, Le] = useState(null),
    [ze, yt] = useState(!1),
    [Oe, ot] = useState(!1),
    [os, is] = useState(!1),
    [zt, Xt] = useState(!1),
    Wt = useRef(null),
    Ft = useRef(null),
    [De, He] = useState(!!Qt.currentUser),
    [activeAnnouncements, setActiveAnnouncements] = useState<Announcement[]>([]),
    [dismissedAnnouncements, setDismissedAnnouncements] = useState<Record<string, boolean>>({}),
    [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const visibleAnnouncement = activeAnnouncements.find(
    (announcement) => !dismissedAnnouncements[announcement.id]
  ) ?? null;

  useEffect(() => {
    const unsub = me.onAnnouncementsChange((list) => {
      const relevant = list.filter(a => a.isActive && (a.target === 'all' || a.targetGarageId === (t == null ? void 0 : t.id)));
      setActiveAnnouncements(relevant);
    });
    return () => unsub();
  }, [t == null ? void 0 : t.id]);
  useEffect(() => {
    const _e = Qt.onAuthStateChanged((st) => {
      He(!!st);
    });
    return () => _e();
  }, []);
  const tt = !0,
    at = useMemo(() => Ac(t), [t]),
    mt = useMemo(() => t.balance || 0, [t.balance]),
    bs = useMemo(() => t.commissionPerVehicle || 1, [t.commissionPerVehicle]),
    L = useMemo(() => at, [tt, at, mt, bs]),
    se = useMemo(
      () =>
        l.length > 0
          ? l.length
          : typeof t.carsInside == "number"
            ? Math.max(0, t.carsInside)
            : 0,
      [l.length, t.carsInside],
    ),
    [Ae, Ge] = useState(null),
    Ke = useRef(L),
    We = L <= 3,
    Ds =
      L <= 0
        ? "انتهى اشتراك الجراج"
        : L === 1
          ? "ينتهي الاشتراك اليوم! يرجى الشحن قبل 5 مساءً"
          : L === 2
            ? "متبقي يومان على انتهاء الاشتراك"
            : "باقي أيام قليلة على انتهاء الاشتراك",
    [Ps, Ws] = useState(!1);
  useEffect(() => {
    if (!t.balanceExpiry || L > 1) return;
    const _e = () => {
      const Ue = new Date().getHours();
      if (Ue >= 10 && Ue < 17) {
        const Zt = new Date().toISOString().slice(0, 10),
          wt = "last_sub_alert_".concat(t.id, "_").concat(Zt),
          Es = localStorage.getItem(wt),
          Ht = 7200 * 1e3,
          B = Date.now();
        (!Es || B - Number(Es) >= Ht) && Ws(!0);
      }
    };
    _e();
    const st = setInterval(_e, 300 * 1e3);
    return () => clearInterval(st);
  }, [tt, L, t.id]);
  const hs = () => {
    Ws(!1);
    const _e = new Date().toISOString().slice(0, 10),
      st = "last_sub_alert_".concat(t.id, "_").concat(_e);
    localStorage.setItem(st, Date.now().toString());
  };
  useEffect(() => {
    const _e = L - Ke.current;
    if (_e < 0) {
      Ge("decrease");
      const st = setTimeout(() => {
        Ge(null);
      }, 1200);
      return ((Ke.current = L), () => clearTimeout(st));
    } else if (_e > 0) {
      Ge("increase");
      const st = setTimeout(() => {
        Ge(null);
      }, 1200);
      return ((Ke.current = L), () => clearTimeout(st));
    }
    Ke.current = L;
  }, [L]);
  const Ns = isSubscriptionExpired(t),
    ne = t.isLocked || !1;
  (useEffect(() => {
    if (!De) return;
    const _e = me.subscribeToGarageRechargeLogs(t.id, (st) => {
      if (st.length > 0) {
        const Ue = st[0].id;
        if (
          localStorage.getItem("acknowledged_recharge_".concat(t.id)) !== Ue
        ) {
          const wt = pt(st[0].timestamp),
            Ht = new Date().getTime() - wt.getTime(),
            B = Ht < 1440 * 60 * 1e3;
          if ((Te(B), Le(st[0]), Ht < 300 * 1e3)) {
            if (
              (yt(!0),
              localStorage.getItem("dashboard_seen_recharge_".concat(t.id)) !==
                Ue)
            ) {
              if (Ht < 600 * 1e3)
                try {
                  Rn.play("checkIn");
                } catch (Ia) {
                  console.error(Ia);
                }
              localStorage.setItem("dashboard_seen_recharge_".concat(t.id), Ue);
            }
          } else yt(!1);
        } else (Te(!1), Le(null), yt(!1));
      } else (Te(!1), Le(null), yt(!1));
    });
    return () => _e();
  }, [t.id, De]),
    useEffect(
      () => () => {
        document.body.style.overflow = "unset";
      },
      [ne],
    ),
    useEffect(() => {
      if (De && !e && t?.hasMonthlySubscribers) {
        const _e = me.subscribeToSubscribers(t.id, (st) => {
          const Ue = new Date();
          Ue.setHours(0, 0, 0, 0);
          let Zt = 0;
          (st.forEach((wt) => {
            const Es = new Date(wt.endDate);
            Math.ceil((Es.getTime() - Ue.getTime()) / (1e3 * 60 * 60 * 24)) <=
              3 && Zt++;
          }),
            Se(Zt));
        });
        return () => _e();
      }
    }, [t.id, e, De, t?.hasMonthlySubscribers]));
  const $e = useCallback(() => {
      (Re && localStorage.setItem("acknowledged_recharge_".concat(t.id), Re.id),
        Te(!1),
        yt(!1));
    }, [t.id, Re]),
    Ye = useCallback(
      (_e) =>
        _e
          ? pt(_e).toLocaleDateString("ar-EG", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "غير معروف",
      [],
    ),
    $t = useCallback(
      (_e) =>
        _e
          ? pt(_e).toLocaleTimeString("ar-EG", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "غير معروف",
      [],
    );
  useEffect(() => {
    ke(15);
  }, [ie]);
  const ls = l.slice(0, W);
  useEffect(() => {
    const _e = new IntersectionObserver(
      (st) => {
        st[0].isIntersecting && W < l.length && ke((Ue) => Ue + 10);
      },
      {
        threshold: 0.1,
        root: Ft.current,
        rootMargin: "100px",
      },
    );
    return (Wt.current && _e.observe(Wt.current), () => _e.disconnect());
  }, [l.length, W, ie]);
  const ys = (_e) => {
    (O(!1),
      j(_e === "subscribers"),
      ot(_e === "reports"),
      Q(_e === "packages"),
      is(_e === "rewards"),
      X(_e === "history"),
      te(_e === "staff"),
      Xt(_e === "appearance"));
  };
  return (
    <div
      className="h-[100dvh] bg-[#faf9f6] dark:bg-transparent font-sans w-full flex flex-col items-center overflow-hidden relative"
      dir="rtl"
    >
      {!s && (
        <header className="relative bg-[#faf9f6] dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 z-40 w-full shrink-0">
          {
            <div className="max-w-4xl mx-auto flex justify-between items-center w-full">
              {
                <div className="flex items-center">
                  {!visibleAnnouncement ? (
                    <div className="h-11 px-4 bg-slate-900 dark:bg-slate-800 border border-slate-900 dark:border-slate-800 text-white rounded-2xl flex items-center justify-center shadow-sm font-black text-xs select-none">
                      <span className="text-slate-100 dark:text-slate-200">
                        {t.name}
                      </span>
                    </div>
                  ) : (
                    <div
                      className="h-11 w-11 bg-slate-900 dark:bg-slate-800 border border-slate-900 dark:border-slate-800 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-sm select-none pointer-events-none"
                      title={t.name}
                    >
                      <Crown className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
              }
              {visibleAnnouncement && (
                <button
                  type="button"
                  aria-label="عرض الإعلان المهم"
                  onClick={() => {
                    setSelectedAnnouncement(visibleAnnouncement);
                    setDismissedAnnouncements((previous) => ({
                      ...previous,
                      [visibleAnnouncement.id]: true,
                    }));
                  }}
                  className="absolute left-1/2 -translate-x-1/2 h-11 max-w-[min(60vw,280px)] px-4 bg-[#f8f6f0] dark:bg-slate-800 border-2 border-[#1a1915] dark:border-slate-700 rounded-2xl shadow-[2px_2px_0px_0px_#1a1915] dark:shadow-none font-black text-xs truncate transition-transform active:translate-y-[2px] active:shadow-none flex items-center justify-center"
                >
                  <span className={`inline-flex items-center gap-2 truncate ${
                    visibleAnnouncement.priority === 'urgent' ? 'text-red-600 dark:text-red-400' :
                    visibleAnnouncement.priority === 'important' ? 'text-amber-600 dark:text-amber-400' :
                    'text-[#1a1915] dark:text-amber-400'
                  }`}>
                    <Megaphone className="w-4 h-4 shrink-0" />
                    <span className="truncate">إعلان مهم</span>
                  </span>
                </button>
              )}
              {
                <div className="flex items-center gap-3">
                  {
                    <button
                      type="button"
                      onClick={() => O(!_)}
                      className={"relative w-11 h-11 border rounded-2xl flex items-center justify-center transition-all outline-none ".concat(
                        _
                          ? "bg-red-600 text-white border-red-700"
                          : "bg-slate-900 dark:bg-slate-800 text-white border-slate-900 dark:border-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700",
                      )}
                    >
                      {(ve > 0 || ue) && !_ && (
                        <span
                          className={"absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ".concat(
                            ue ? "bg-emerald-500" : "bg-red-500",
                          )}
                        />
                      )}
                      {_ ? (
                        <XIcon className="w-6 h-6 stroke-[3]" />
                      ) : (
                        <Users className="w-6 h-6 stroke-[3]" />
                      )}
                    </button>
                  }
                </div>
              }
            </div>
          }
        </header>
      )}
      {
        <AnimatePresence>
          {_ && (
            <React.Fragment>
              {
                <motion.div
                  initial={{
                    opacity: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                  exit={{
                    opacity: 0,
                  }}
                  onClick={() => O(!1)}
                  className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 z-[150] pointer-events-auto"
                  style={{
                    willChange: "opacity",
                    transform: "translate3d(0, 0, 0)",
                    backfaceVisibility: "hidden",
                  }}
                />
              }
              {
                <motion.div
                  initial={{
                    x: "-100%",
                    opacity: 0,
                  }}
                  animate={{
                    x: 0,
                    opacity: 1,
                  }}
                  exit={{
                    x: "-100%",
                    opacity: 0,
                  }}
                  transition={{
                    type: "spring",
                    damping: 26,
                    stiffness: 220,
                  }}
                  className="fixed top-3 bottom-3 left-3 w-[220px] xs:w-[245px] bg-[#faf9f6] dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-800/80 z-[150] flex flex-col overflow-hidden pointer-events-auto"
                  style={{
                    willChange: "transform, opacity",
                    transform: "translate3d(0, 0, 0)",
                    backfaceVisibility: "hidden",
                  }}
                  dir="rtl"
                >
                  {
                    <div className="p-4 pb-3 border-b border-slate-100 dark:border-slate-800/60">
                      {
                        <div className="flex items-center justify-between">
                          {
                            <div className="flex items-center gap-2">
                              {
                                <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 flex items-center justify-center font-extrabold shrink-0 shadow-sm">
                                  <Crown className="w-5 h-5 text-amber-400 dark:text-slate-950" />
                                </div>
                              }
                              {
                                <div className="flex flex-col min-w-0">
                                  {
                                    <span className="text-mobile-wrap text-xs font-black text-slate-900 dark:text-slate-100 max-w-[120px] leading-snug">
                                      {e ? e.name : "مدير الجراج"}
                                    </span>
                                  }
                                </div>
                              }
                            </div>
                          }
                          {
                            <button
                              type="button"
                              onClick={() => O(!1)}
                              className="w-8 h-8 bg-red-500 dark:bg-red-600 text-white rounded-lg flex items-center justify-center hover:bg-red-600 dark:hover:bg-red-700 transition-colors outline-none shrink-0"
                            >
                              {<XIcon className="w-5 h-5" />}
                            </button>
                          }
                        </div>
                      }
                    </div>
                  }
                  {
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar-slate">
                      {
                        <div className="space-y-2">
                          {!e && t?.hasMonthlySubscribers && (
                            <button
                              onClick={() => ys("subscribers")}
                              className="w-full flex items-center justify-between p-2.5 bg-[#faf9f6] dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border-2 border-slate-150 dark:border-slate-800 transition-all outline-none"
                            >
                              {
                                <div className="flex items-center gap-2.5">
                                  {
                                    <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 flex items-center justify-center shrink-0 shadow-sm">
                                      {<Users className="w-4 h-4 text-amber-400 dark:text-slate-950" />}
                                    </div>
                                  }
                                  {
                                    <span className="font-bold text-sm">
                                      الاشتراكات
                                    </span>
                                  }
                                </div>
                              }
                              {ve > 0 && (
                                <span className="px-2 py-0.5 rounded-md bg-red-600 text-white dark:bg-red-500 dark:text-slate-950 text-xs font-black">
                                  {ve}
                                </span>
                              )}
                            </button>
                          )}
                          {!e && (
                            <button
                              onClick={() => ys("reports")}
                              className="w-full flex items-center justify-between p-2.5 bg-[#faf9f6] dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border-2 border-slate-150 dark:border-slate-800 transition-all outline-none animate-fade-in"
                            >
                              {
                                <div className="flex items-center gap-2.5">
                                  {
                                    <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 flex items-center justify-center shrink-0 shadow-sm">
                                      {
                                        <PieChart className="w-4 h-4 text-amber-400 dark:text-slate-950" />
                                      }
                                    </div>
                                  }
                                  {
                                    <span className="font-bold text-sm">
                                      التقارير الذكية
                                    </span>
                                  }
                                </div>
                              }
                            </button>
                          )}
                          {
                            <button
                              onClick={() => ys("packages")}
                              className="w-full flex items-center justify-between p-2.5 bg-[#faf9f6] dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border-2 border-slate-150 dark:border-slate-800 transition-all outline-none"
                            >
                              {
                                <div className="flex items-center gap-2.5">
                                  {
                                    <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 flex items-center justify-center shrink-0 shadow-sm">
                                      {
                                        <Zap className="w-4 h-4 fill-current text-amber-400 dark:text-slate-950" />
                                      }
                                    </div>
                                  }
                                  {
                                    <span className="font-bold text-sm">
                                      باقات الاشتراكات
                                    </span>
                                  }
                                </div>
                              }
                            </button>
                          }
                          {!e && (
                            <button
                              onClick={() => ys("rewards")}
                              className="w-full flex items-center justify-between p-2.5 bg-[#faf9f6] dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border-2 border-slate-150 dark:border-slate-800 transition-all outline-none animate-fade-in"
                            >
                              {
                                <div className="flex items-center gap-2.5">
                                  {
                                    <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 flex items-center justify-center shrink-0 shadow-sm">
                                      {
                                        <Gift className="w-4 h-4 text-amber-400 dark:text-slate-950" />
                                      }
                                    </div>
                                  }
                                  {
                                    <span className="font-bold text-sm">
                                      المكافآت
                                    </span>
                                  }
                                </div>
                              }
                              {(t.totalReferralRewardDays || 0) > 0 && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-xs font-black font-mono">
                                  +{t.totalReferralRewardDays} يوم
                                </span>
                              )}
                            </button>
                          )}
                          {
                            <button
                              onClick={() => ys("history")}
                              className="w-full flex items-center justify-between p-2.5 bg-[#faf9f6] dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border-2 border-slate-150 dark:border-slate-800 transition-all outline-none"
                            >
                              {
                                <div className="flex items-center gap-2.5">
                                  {
                                    <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 flex items-center justify-center shrink-0 shadow-sm">
                                      {
                                        <Clock className="w-4 h-4 text-amber-400 dark:text-slate-950" />
                                      }
                                    </div>
                                  }
                                  {
                                    <span className="font-bold text-sm">
                                      تاريخ الشحن
                                    </span>
                                  }
                                </div>
                              }
                              {ue && (
                                <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-black flex items-center gap-1">
                                  {
                                    <span className="w-1 h-1 bg-rose-500 rounded-full" />
                                  }
                                  شحن جديد
                                </span>
                              )}
                            </button>
                          }
                          {
                            <button
                              onClick={() => ys("appearance")}
                              className="w-full flex items-center justify-between p-2.5 bg-[#faf9f6] dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border-2 border-slate-150 dark:border-slate-800 transition-all outline-none"
                            >
                              {
                                <div className="flex items-center gap-2.5">
                                  {
                                    <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 flex items-center justify-center shrink-0 shadow-sm">
                                      {
                                        <Sliders className="w-4 h-4 text-amber-400 dark:text-slate-950" />
                                      }
                                    </div>
                                  }
                                  {
                                    <span className="font-bold text-sm">
                                      إعدادات المظهر
                                    </span>
                                  }
                                </div>
                              }
                            </button>
                          }
                        </div>
                      }
                    </div>
                  }
                  {
                    <div className="p-3.5 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/40">
                      {
                        <button
                          onClick={() => {
                            (O(!1), E());
                          }}
                          className="w-full flex items-center justify-center gap-2.5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all font-black text-sm outline-none"
                        >
                          {<LogOut className="w-5 h-5 rotate-180" />}
                          {<span>تسجيل الخروج</span>}
                        </button>
                      }
                    </div>
                  }
                </motion.div>
              }
            </React.Fragment>
          )}
        </AnimatePresence>
      }
      {
        <main
          className={"max-w-md md:max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto p-4 w-full flex-1 flex flex-col gap-4 md:gap-6 overscroll-contain overflow-y-auto ".concat(
            s ? "gap-3 pt-3 pb-3" : "gap-4",
          )}
        >
          {/* Removed old announcements banner from here */}

          {/* Removed Expiry Warning Banner as requested */}

          {(() => {
            const todayStr = getCairoDateKey();
            const displayTodayCount = t.lastTransactionDate === todayStr ? (t.todayCount || 0) : 0;
            const isDailyLimitReached = !isUnlimitedCapacity(t) && displayTodayCount >= getEffectiveDailyCapacity(t);

            if ((s && ie === "main") || isDailyLimitReached || Ns) {
              return null;
            }

            return (
              <div className="flex gap-4 shrink-0 w-full select-none" id="persistent_balance_card">
                {/* RIGHT CARD: Subscription countdown */}
                <div
                  className={"flex-1 transition-all duration-300 py-2.5 md:py-6 px-4 md:px-6 rounded-[1.75rem] border flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden ".concat(
                    L <= 1
                      ? "bg-red-600 dark:bg-red-700 border-red-700 dark:border-red-600 text-white shadow-md shadow-red-500/20"
                      : L === 2
                        ? "bg-red-500/10 dark:bg-red-950/40 border-red-300 dark:border-red-800/80 text-red-600 dark:text-red-400"
                        : Ae === "decrease"
                          ? "border-red-500/50 shadow-[0_4px_24px_rgba(239,68,68,0.12)] bg-[#faf9f6] dark:bg-slate-900"
                          : Ae === "increase"
                            ? "border-emerald-500/50 shadow-[0_4px_24px_rgba(16,185,129,0.12)] bg-[#faf9f6] dark:bg-slate-900"
                            : "bg-[#faf9f6] dark:bg-slate-900 border-slate-200 dark:border-slate-800",
                  )}
                >
                  <MovingBalanceArrows transitionType={Ae} />

                  {/* Trial Badge */}
                  {t?.isTrial && (
                    <div className="mb-2 z-10">
                      <span className="bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] font-black px-3 py-1 rounded-full border border-amber-500/30 inline-flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>تجريبي</span>
                      </span>
                    </div>
                  )}

                  {/* Countdown */}
                  <div className="py-1 flex items-center justify-center overflow-visible z-10">
                    <div
                      className={"text-2xl md:text-4xl font-black transition-colors duration-300 flex items-center gap-2 ".concat(
                        L <= 1
                          ? "text-white"
                          : L === 2 || Ae === "decrease"
                            ? "text-red-600 dark:text-red-400"
                            : Ae === "increase"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : We
                                ? "text-red-500"
                                : "text-slate-900 dark:text-slate-100",
                      )}
                    >
                      <span>باقي</span>
                      <span className="text-4xl md:text-7xl font-extrabold font-mono tracking-tight">
                        <AnimatedCounter value={L} disableColorChange={!0} />
                      </span>
                      <span>
                        {L === 1
                          ? "يوم"
                          : L === 2
                            ? "يومين"
                            : L >= 3 && L <= 10
                              ? "أيام"
                              : "يوم"}
                      </span>
                    </div>
                  </div>

                  {We && (
                    <p
                      className={"text-[10px] md:text-sm font-black uppercase tracking-widest mt-1 transition-colors duration-300 z-10 ".concat(
                        L <= 1
                          ? "text-white/90 font-black"
                          : L === 2 || Ae === "decrease"
                            ? "text-red-600 dark:text-red-400"
                            : Ae === "increase"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : L <= 0
                                ? "text-red-500"
                                : "text-red-400",
                      )}
                    >
                      {Ds}
                    </p>
                  )}
                </div>

                {/* LEFT CARD: Daily cars info (For Limited Subscriptions) */}
                {!isUnlimitedCapacity(t) && (
                  <div className="flex-1 transition-all duration-300 py-2.5 md:py-6 px-4 md:px-6 rounded-[1.75rem] border flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden bg-[#faf9f6] dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">العدد اليومي</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl md:text-6xl font-extrabold font-mono text-slate-900 dark:text-slate-100">
                        {displayTodayCount}
                      </span>
                      <span className="text-lg md:text-2xl font-bold text-slate-400 font-mono">
                        /{getEffectiveDailyCapacity(t)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          {ie === "main" ? (
            <React.Fragment>
              {(() => {
                const todayStr = getCairoDateKey();
                const displayTodayCount = t.lastTransactionDate === todayStr ? (t.todayCount || 0) : 0;
                const isDailyLimitReached = !isUnlimitedCapacity(t) && displayTodayCount >= getEffectiveDailyCapacity(t);

                if (isDailyLimitReached || Ns) {
                  return (
                    <div className="bg-[#faf9f6] dark:bg-slate-900 rounded-[2rem] border border-red-200/80 dark:border-red-900/60 relative shrink-0 p-4 md:p-8 max-w-md md:max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto w-full transition-all duration-150 shadow-sm overflow-hidden">
                      {/* Outer Alternating Laser Shimmer: sweeps upwards during second half of cycle */}
                      <BorderShimmer isActive={true} rx={32} ry={32} color="#ef4444" dur="7.0s" mode="alternate-second" />

                      <div className="relative h-48 sm:h-56 md:h-72 lg:h-80 rounded-2xl overflow-hidden bg-gradient-to-b from-red-500/10 via-red-500/5 to-transparent dark:from-red-950/40 dark:via-red-950/20 dark:to-transparent border-2 border-red-500/30 dark:border-red-500/40 flex flex-col items-center justify-center p-4 sm:p-6 text-center shadow-[inset_0_0_25px_rgba(239,68,68,0.12)]">
                        {/* Inner Alternating Laser Shimmer: sweeps downwards during first half of cycle */}
                        <BorderShimmer isActive={true} rx={16} ry={16} color="#ef4444" dur="7.0s" mode="alternate-first" />

                        {/* Subtle Laser Radar Ambient Glow */}
                        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                          <div 
                            className="absolute -inset-[100%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-500/15 via-transparent to-transparent animate-pulse" 
                            style={{ animationDuration: '6s' }}
                          />
                        </div>

                        {/* Content */}
                        <div className="relative z-20 w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-red-100 dark:bg-red-900/60 flex items-center justify-center text-red-600 dark:text-red-400 mb-3 shadow-md shadow-red-500/20 shrink-0">
                          <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8" />
                        </div>
                        
                        <h3 className="relative z-20 text-base sm:text-xl md:text-2xl font-black text-red-600 dark:text-red-400 leading-tight drop-shadow-sm mb-1.5 sm:mb-2">
                          {Ns ? "انتهى الاشتراك" : "وصلت للحد الأقصى اليومي"}
                        </h3>
                        
                        {isDailyLimitReached && !Ns ? (
                          <p className="relative z-20 text-sm sm:text-base md:text-lg font-bold text-slate-800 dark:text-slate-200 font-mono tracking-wide mb-2">
                            ({displayTodayCount} / {getEffectiveDailyCapacity(t)} سيارة اليوم)
                          </p>
                        ) : (
                          <p className="relative z-20 text-sm sm:text-base md:text-lg font-bold text-slate-800 dark:text-slate-200 tracking-wide mb-2">
                            عذراً، لقد انتهى اشتراك الجراج الخاص بك
                          </p>
                        )}
                        
                        <p className="relative z-20 text-xs sm:text-sm md:text-base font-medium text-slate-500 dark:text-slate-400 max-w-xs sm:max-w-md">
                          {Ns ? "يرجى التواصل مع الإدارة لتجديد الاشتراك ومتابعة العمل" : "يرجى اختيار اشتراك أكبر لمتابعة تسجيل السيارات"}
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })() || (
                <RegistrationCard
                  newPlateNumber={x}
                  setNewPlateNumber={b}
                  isInputFocused={s}
                  setIsInputFocused={y}
                  plateInputRef={k}
                  vehicles={l}
                  garage={t}
                  handleCheckIn={T}
                  onCheckOut={(_e) => {
                    (d(_e), h(!0));
                  }}
                  closeKeyboard={m}
                  inputRef={D}
                  shimmerActive={!0}
                />
              )}
              {!s && (
                <div className="bg-[#faf9f6] dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-[2rem] overflow-hidden flex flex-col items-center pt-4 md:pt-10 transition-colors w-full shadow-sm relative">
                  {
                    <div
                      onClick={() => H("active_vehicles")}
                      className="mb-4 md:mb-10 cursor-pointer w-full flex justify-center"
                    >
                      <div className="relative flex flex-col items-center w-full px-4 md:px-8">
                        <FlipNumber value={t.carsInside || 0} size="lg" />
                      </div>
                    </div>
                  }
                  {
                    <button
                      onClick={() => H("active_vehicles")}
                      className="w-full h-6 md:h-7 relative overflow-hidden group outline-none select-none flex items-center justify-center shrink-0 transition-colors"
                      style={{
                        backgroundColor: we,
                      }}
                    >
                      {
                        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                          {
                            <div
                              className={"w-7 h-7 md:w-8 h-8 rounded-full flex items-center justify-center border-2 shadow-md group-hover:scale-110 transition-all ".concat(
                                ur(we) ? "text-slate-900" : "text-white",
                              )}
                              style={{
                                backgroundColor: we,
                                borderColor: "".concat(we, "80"),
                              }}
                            >
                              {
                                <Car
                                  className={"w-3.5 h-3.5 md:w-4 md:h-4 group-active:translate-y-0.5 transition-transform ".concat(
                                    ur(we) ? "text-slate-900" : "text-white",
                                  )}
                                />
                              }
                            </div>
                          }
                        </div>
                      }
                    </button>
                  }
                </div>
              )}
            </React.Fragment>
          ) : (
            <React.Fragment>
              {
                <div className="bg-[#faf9f6] dark:bg-slate-900 rounded-[2rem] border border-slate-150 dark:border-slate-800 overflow-hidden flex flex-col flex-1 min-h-[400px] md:min-h-[500px] transition-colors w-full shadow-sm">
                  {
                    <div className="p-3 md:p-4 px-4 md:px-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 shrink-0 transition-colors">
                      {
                        <div className="flex items-center gap-3">
                          {
                            <div className="w-8 h-8 md:w-11 md:h-11 bg-slate-900 dark:bg-slate-800 rounded-lg flex items-center justify-center text-white transition-all">
                              {
                                <Car className="w-4 h-4 md:w-6 md:h-6" />
                              }
                            </div>
                          }
                          {
                            <div>
                              {
                                <h3 className="font-black text-slate-900 dark:text-white text-sm md:text-lg uppercase tracking-tight">
                                  إجمالى العدد {se}
                                </h3>
                              }
                            </div>
                          }
                        </div>
                      }
                      {
                        <div className="flex items-center gap-3">
                          {
                            <button
                              onClick={() => H("main")}
                              className="w-8 h-8 md:w-11 md:h-11 bg-red-500 dark:bg-red-600 text-white rounded-xl flex shrink-0 items-center justify-center hover:bg-red-600 dark:hover:bg-red-700 transition-colors outline-none shadow-sm"
                            >
                              {<XIcon className="w-4 h-4 md:w-5 md:h-5" />}
                            </button>
                          }
                        </div>
                      }
                    </div>
                  }
                  {
                    <div
                      ref={Ft}
                      className="divide-y divide-slate-100 dark:divide-slate-800 flex-1 overflow-y-auto custom-scrollbar overscroll-contain touch-pan-y bg-[#faf9f6] dark:bg-slate-900 transition-colors"
                    >
                      {ls.map((_e) => (
                        <VehicleItem
                          key={_e.id || _e.plateNumber}
                          vehicle={_e}
                          onCheckOut={(st) => {
                            (m(), d(st), h(!0));
                          }}
                        />
                      ))}
                      {W < l.length && (
                        <div
                          ref={Wt}
                          className="py-8 flex justify-center items-center"
                        >
                          {
                            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                          }
                        </div>
                      )}
                      {l.length === 0 && (
                        <div className="py-16 md:py-24 text-center flex flex-col items-center gap-4">
                          <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700">
                            <Car className="w-10 h-10 md:w-12 md:h-12 text-slate-300 dark:text-slate-600" />
                          </div>
                          <p className="text-lg md:text-xl font-black text-slate-400 dark:text-slate-500">
                            لا توجد سيارات حالياً
                          </p>
                          <p className="text-xs font-bold text-slate-300 dark:text-slate-600">
                            اكتب رقم اللوحة واضغط "ساعة" أو "مبيت" لتسجيل أول عربية
                          </p>
                          {!Ns && (
                            <button
                              onClick={() => H("main")}
                              className="mt-6 text-sm md:text-base font-black text-emerald-500 uppercase tracking-widest border-b-2 border-emerald-500/20 pb-0.5"
                            >
                              سجل دخول عربية جديدة
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  }
                </div>
              }
            </React.Fragment>
          )}
          {
            <div
              className={"mt-auto mb-2 py-4 flex items-center justify-center gap-3 select-none text-slate-400 dark:text-slate-500 font-bold text-[10px] md:text-xs tracking-wider uppercase transition-all duration-300 ".concat(
                s || ie !== "main"
                  ? "opacity-0 h-0 overflow-hidden pointer-events-none py-0 my-0"
                  : "opacity-100",
              )}
            >
              {
                <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-slate-200 dark:to-slate-800" />
              }
              {
                <span className="brand-shimmer-text">
                  ARQ FOR SOFTWARE DEVELOPMENT
                </span>
              }
              {
                <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-slate-200 dark:to-slate-800" />
              }
            </div>
          }
        </main>
      }
      {ne && (
        <div className="fixed inset-0 z-[90] bg-slate-900/95 flex items-center justify-center p-6 text-center">
          {
            <div className="max-w-sm w-full">
              {
                <div className="w-20 h-20 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-6">
                  {<AlertTriangle className="w-10 h-10 text-red-500" />}
                </div>
              }
              {
                <h2 className="text-2xl font-black text-white mb-3">
                  الجراج مغلق حالياً
                </h2>
              }
              {
                <div className="space-y-4 mb-8">
                  {
                    <p className="text-base md:text-lg font-bold text-slate-400 dark:text-slate-300 leading-relaxed px-4">
                      {t.lockReason ||
                        "تم تعليق الخدمة مؤقتاً، يرجى التواصل مع الإدارة."}
                    </p>
                  }
                  {
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 inline-block">
                      {
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                          رقم الإدارة
                        </p>
                      }
                      {
                        <p
                          className="text-xl font-black text-white font-mono tracking-widest"
                          dir="ltr"
                        >
                          {I}
                        </p>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      )}
      {R && t?.hasMonthlySubscribers && (
        <SubscribersView
          garage={t}
          onClose={() => j(!1)}
          showToast={V}
          onToggleMenu={() => O(!_)}
        />
      )}
      {z && (
        <RechargeHistoryView
          garage={t}
          onClose={() => {
            (X(!1), Te(!1));
          }}
          showToast={V}
          onToggleMenu={() => O(!_)}
        />
      )}
      {Y && (
        <PackagesModal
          packages={F}
          onClose={() => Q(!1)}
          garageHourlyRate={t.hourlyRate}
          walletNumber={I}
          onToggleMenu={() => O(!_)}
          subscriptionPrices={A}
          hasMonthlySubscribers={t.hasMonthlySubscribers}
        />
      )}
      {os && (
        <RewardsModal
          garage={t}
          onClose={() => is(!1)}
          onToggleMenu={() => O(!_)}
          referralBonusBalance={t.referralBonusBalance || 0}
          showToast={V}
        />
      )}
      {ce && !e && (
        <StaffStatsModal
          staffList={q}
          vehiclesInside={l}
          todayExitedVehicles={c}
          onClose={() => te(!1)}
          now={a}
          onToggleMenu={() => O(!_)}
        />
      )}
      {Oe && !e && (
        <GarageReportsView
          garage={t}
          vehiclesInside={l}
          todayExitedVehicles={c}
          staffList={q}
          onClose={() => ot(!1)}
          onToggleMenu={() => O(!_)}
        />
      )}
      {zt && (
        <AppearanceSettingsModal
          garage={t}
          currentStaff={e}
          onClose={() => Xt(!1)}
          showToast={V}
          onToggleMenu={() => O(!_)}
        />
      )}
      {ze && Re && (
        <div
          className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 z-[110] flex items-center justify-center p-4 animate-none"
          onClick={$e}
        >
          {
            <div
              className="w-full max-w-md bg-[#faf9f6] dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl p-6 shadow-2xl relative overflow-hidden"
              onClick={(_e) => _e.stopPropagation()}
              dir="rtl"
            >
              {
                <div className="absolute top-0 right-1/2 translate-x-1/2 w-48 h-48 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
              }
              {
                <button
                  onClick={$e}
                  className="w-10 h-10 bg-red-500 text-white rounded-xl flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm outline-none"
                >
                  {<XIcon className="w-6 h-6" />}
                </button>
              }
              {
                <div className="text-center mt-4">
                  {
                    <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/20 dark:shadow-emerald-500/10">
                      {<Zap className="w-8 h-8 fill-current" />}
                    </div>
                  }
                  {
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                      تم تجديد الاشتراك بنجاح!
                    </h3>
                  }
                  {
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-6">
                      اشتراك جديد مضاف إلى الحساب الخاص بالجراج
                    </p>
                  }
                  {
                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4.5 text-right space-y-3.5 border border-slate-100 dark:border-slate-800/50 mb-6">
                      {
                        <div className="flex justify-between items-start gap-4">
                          {
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 flex-shrink-0">
                              اسم الباقة:
                            </span>
                          }
                          {
                            <span className="text-sm font-black text-slate-900 dark:text-white leading-tight text-left">
                              {Re.plateNumber}
                            </span>
                          }
                        </div>
                      }
                      {
                        <div className="w-full border-t border-slate-200/40 dark:border-slate-800/40" />
                      }
                      {
                        <div className="flex justify-between items-center">
                          {
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                              القيمة المالية:
                            </span>
                          }
                          {
                            <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                              {Re.amount !== void 0
                                ? "".concat(Re.amount, " ج.م")
                                : "مجانية"}
                            </span>
                          }
                        </div>
                      }
                      {
                        <div className="w-full border-t border-slate-200/40 dark:border-slate-800/40" />
                      }
                      {
                        <div className="flex justify-between items-center">
                          {
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                              الوقت والتاريخ:
                            </span>
                          }
                          {
                            <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                              {$t(Re.timestamp)} - {Ye(Re.timestamp)}
                            </span>
                          }
                        </div>
                      }
                      {Re.staffName && (
                        <React.Fragment>
                          {
                            <div className="w-full border-t border-slate-200/40 dark:border-slate-800/40" />
                          }
                          {
                            <div className="flex justify-between items-center">
                              {
                                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                                  بواسطة:
                                </span>
                              }
                              {
                                <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                                  {Re.staffName.includes("مدير النظام") ||
                                  Re.staffName.toLowerCase().includes("admin")
                                    ? "مدير النظام"
                                    : Re.staffName}
                                </span>
                              }
                            </div>
                          }
                        </React.Fragment>
                      )}
                    </div>
                  }
                  {
                    <button
                      onClick={$e}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 px-6 rounded-2xl font-black text-sm transition-all shadow-lg shadow-emerald-600/10 dark:shadow-emerald-600/5 uppercase tracking-wider block"
                    >
                      إغلاق النافذة
                    </button>
                  }
                </div>
              }
            </div>
          }
        </div>
      )}
      {Ps && (
        <div
          className="fixed inset-0 bg-slate-900/70 dark:bg-slate-950/85 z-[120] flex items-center justify-center p-4 animate-fade-in"
          onClick={hs}
        >
          {
            <div
              className="w-full max-w-md bg-white dark:bg-slate-900 border-2 border-red-500/30 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden text-right"
              onClick={(_e) => _e.stopPropagation()}
              dir="rtl"
            >
              {
                <div className="absolute top-0 right-1/2 translate-x-1/2 w-48 h-48 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />
              }
              {
                <button
                  onClick={hs}
                  className="absolute top-4 left-4 w-9 h-9 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full flex items-center justify-center transition-colors outline-none"
                >
                  {<XIcon className="w-5 h-5" />}
                </button>
              }
              {
                <div className="text-center mt-2">
                  {
                    <div className="w-16 h-16 bg-red-500/15 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20 shadow-sm">
                      {<AlertTriangle className="w-8 h-8" />}
                    </div>
                  }
                  {
                    <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-2">
                      تنبيه انتهاء الاشتراك
                    </h3>
                  }
                  {
                    <p className="text-sm md:text-base font-black text-red-600 dark:text-red-400 mb-4 leading-relaxed bg-red-50 dark:bg-red-950/40 p-4 rounded-2xl border border-red-200 dark:border-red-900/50 shadow-inner">
                      إشتراكك هينتهى النهاردة الحق اشحن قبل الساعة 5 علشان تقدر
                      تكمل شغل
                    </p>
                  }
                  {
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                      يرجى طلب تجديد الاشتراك من باقات الاشتراكات مع المندوب
                      الخاص بك لتجنب توقف الخدمة.
                    </p>
                  }
                  {
                    <div className="flex flex-col gap-2.5">
                      {
                        <button
                          onClick={() => {
                            (hs(), Q(!0));
                          }}
                          className="w-full bg-red-600 hover:bg-red-700 text-white py-3.5 px-6 rounded-2xl font-black text-sm md:text-base transition-all shadow-lg shadow-red-600/20 uppercase tracking-wider block outline-none"
                        >
                          طلب تجديد الاشتراك الآن
                        </button>
                      }
                      {
                        <button
                          onClick={hs}
                          className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-3 px-6 rounded-2xl font-bold text-xs transition-all outline-none"
                        >
                          تذكيري لاحقاً
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      )}
      <AnimatePresence>
        {selectedAnnouncement && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="announcement-modal-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedAnnouncement(null)}
          >
            <motion.div
              className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-[#faf9f6] dark:bg-slate-900 p-5 shadow-2xl"
              dir="rtl"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-amber-600 dark:text-amber-400">إعلان مهم</p>
                  <h2 id="announcement-modal-title" className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">
                    {selectedAnnouncement.title}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="إغلاق الإعلان"
                  onClick={() => setSelectedAnnouncement(null)}
                  className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 flex items-center justify-center shrink-0"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700 dark:text-slate-200">
                {selectedAnnouncement.content}
              </div>
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                className="mt-5 w-full h-11 rounded-2xl bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 font-black"
              >
                فهمت
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
