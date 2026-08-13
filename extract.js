KO = C.memo(({
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
  subscriptionPrices: A
}) => {
  const [_, O] = be.useState(!1),
    {
      theme: P
    } = qr(),
    we = uo(t == null ? void 0 : t.shimmerColor, P),
    [ie, H] = be.useState("main"),
    [W, ke] = be.useState(15),
    [ve, Se] = be.useState(0),
    [z, X] = be.useState(!1),
    [ue, Te] = be.useState(!1),
    [Re, Le] = be.useState(null),
    [ze, yt] = be.useState(!1),
    [Oe, ot] = be.useState(!1),
    [os, is] = be.useState(!1),
    [zt, Xt] = be.useState(!1),
    Wt = be.useRef(null),
    Ft = be.useRef(null),
    [De, He] = be.useState(!!Qt.currentUser);
  be.useEffect(() => {
    const _e = Qt.onAuthStateChanged(st => {
      He(!!st);
    });
    return () => _e();
  }, []);
  const tt = !0,
    at = be.useMemo(() => Ac(t), [t]),
    mt = be.useMemo(() => t.balance || 0, [t.balance]),
    bs = be.useMemo(() => t.commissionPerVehicle || 1, [t.commissionPerVehicle]),
    L = be.useMemo(() => at, [tt, at, mt, bs]),
    se = be.useMemo(() => l.length > 0 ? l.length : typeof t.carsInside == "number" ? Math.max(0, t.carsInside) : 0, [l.length, t.carsInside]),
    [Ae, Ge] = be.useState(null),
    Ke = be.useRef(L),
    We = L <= 3,
    Ds = L <= 0 ? "انتهى اشتراك الجراج" : L === 1 ? "ينتهي الاشتراك اليوم! يرجى الشحن قبل 5 مساءً" : L === 2 ? "متبقي يومان على انتهاء الاشتراك" : "باقي أيام قليلة على انتهاء الاشتراك",
    [Ps, Ws] = be.useState(!1);
  be.useEffect(() => {
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
  be.useEffect(() => {
    const _e = L - Ke.current;
    if (_e < 0) {
      Ge("decrease");
      const st = setTimeout(() => {
        Ge(null);
      }, 1200);
      return Ke.current = L, () => clearTimeout(st);
    } else if (_e > 0) {
      Ge("increase");
      const st = setTimeout(() => {
        Ge(null);
      }, 1200);
      return Ke.current = L, () => clearTimeout(st);
    }
    Ke.current = L;
  }, [L]);
  const Ns = L <= 0,
    ne = t.isLocked || !1;
  be.useEffect(() => {
    if (!De) return;
    const _e = me.subscribeToGarageRechargeLogs(t.id, st => {
      if (st.length > 0) {
        const Ue = st[0].id;
        if (localStorage.getItem("acknowledged_recharge_".concat(t.id)) !== Ue) {
          const wt = pt(st[0].timestamp),
            Ht = new Date().getTime() - wt.getTime(),
            B = Ht < 1440 * 60 * 1e3;
          if (Te(B), Le(st[0]), Ht < 300 * 1e3) {
            if (yt(!0), localStorage.getItem("dashboard_seen_recharge_".concat(t.id)) !== Ue) {
              if (Ht < 600 * 1e3) try {
                Rn.play("checkIn");
              } catch (Ia) {
                console.error(Ia);
              }
              localStorage.setItem("dashboard_seen_recharge_".concat(t.id), Ue);
            }
          } else yt(!1);
        } else Te(!1), Le(null), yt(!1);
      } else Te(!1), Le(null), yt(!1);
    });
    return () => _e();
  }, [t.id, De]), be.useEffect(() => () => {
    document.body.style.overflow = "unset";
  }, [ne]), be.useEffect(() => {
    if (De && !e) {
      const _e = me.subscribeToSubscribers(t.id, st => {
        const Ue = new Date();
        Ue.setHours(0, 0, 0, 0);
        let Zt = 0;
        st.forEach(wt => {
          const Es = new Date(wt.endDate);
          Math.ceil((Es.getTime() - Ue.getTime()) / (1e3 * 60 * 60 * 24)) <= 3 && Zt++;
        }), Se(Zt);
      });
      return () => _e();
    }
  }, [t.id, e, De]);
  const $e = be.useCallback(() => {
      Re && localStorage.setItem("acknowledged_recharge_".concat(t.id), Re.id), Te(!1), yt(!1);
    }, [t.id, Re]),
    Ye = be.useCallback(_e => _e ? pt(_e).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric"
    }) : "غير معروف", []),
    $t = be.useCallback(_e => _e ? pt(_e).toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit"
    }) : "غير معروف", []);
  be.useEffect(() => {
    ke(15);
  }, [ie]);
  const ls = l.slice(0, W);
  be.useEffect(() => {
    const _e = new IntersectionObserver(st => {
      st[0].isIntersecting && W < l.length && ke(Ue => Ue + 10);
    }, {
      threshold: .1,
      root: Ft.current,
      rootMargin: "100px"
    });
    return Wt.current && _e.observe(Wt.current), () => _e.disconnect();
  }, [l.length, W, ie]);
  const ys = _e => {
    O(!1), j(_e === "subscribers"), ot(_e === "reports"), Q(_e === "packages"), is(_e === "rewards"), X(_e === "history"), te(_e === "staff"), Xt(_e === "appearance");
  };
  return r.jsxs("div", {
    className: "h-[100dvh] bg-[#faf9f6] dark:bg-transparent font-sans w-full flex flex-col items-center overflow-hidden relative",
    dir: "rtl",
    children: [!s && r.jsx("header", {
      className: "relative bg-[#faf9f6] dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 z-40 w-full shrink-0",
      children: r.jsxs("div", {
        className: "max-w-4xl mx-auto flex justify-between items-center w-full",
        children: [r.jsx("div", {
          className: "flex items-center",
          children: r.jsx("div", {
            className: "h-11 px-4 bg-slate-900 dark:bg-slate-800 border border-slate-900 dark:border-slate-800 text-white rounded-2xl flex items-center justify-center shadow-sm font-black text-xs select-none",
            children: r.jsx("span", {
              className: "text-slate-100 dark:text-slate-200",
              children: t.name
            })
          })
        }), r.jsx("div", {
          className: "flex items-center gap-3",
          children: r.jsxs("button", {
            type: "button",
            onClick: () => O(!_),
            className: "relative w-11 h-11 border rounded-2xl flex items-center justify-center transition-all outline-none ".concat(_ ? "bg-red-600 text-white border-red-700" : "bg-slate-900 dark:bg-slate-800 text-white border-slate-900 dark:border-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700"),
            children: [(ve > 0 || ue) && !_ && r.jsx("span", {
              className: "absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ".concat(ue ? "bg-emerald-500" : "bg-red-500")
            }), _ ? r.jsx(Fs, {
              className: "w-6 h-6 stroke-[3]"
            }) : r.jsx(El, {
              className: "w-6 h-6 stroke-[3]"
            })]
          })
        })]
      })
    }), r.jsx(Dc, {
      children: _ && r.jsxs(r.Fragment, {
        children: [r.jsx(Ka.div, {
          initial: {
            opacity: 0
          },
          animate: {
            opacity: 1
          },
          exit: {
            opacity: 0
          },
          onClick: () => O(!1),
          className: "fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 z-[150] pointer-events-auto",
          style: {
            willChange: "opacity",
            transform: "translate3d(0, 0, 0)",
            backfaceVisibility: "hidden"
          }
        }), r.jsxs(Ka.div, {
          initial: {
            x: "-100%",
            opacity: 0
          },
          animate: {
            x: 0,
            opacity: 1
          },
          exit: {
            x: "-100%",
            opacity: 0
          },
          transition: {
            type: "spring",
            damping: 26,
            stiffness: 220
          },
          className: "fixed top-3 bottom-3 left-3 w-[220px] xs:w-[245px] bg-[#faf9f6] dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-800/80 z-[150] flex flex-col overflow-hidden pointer-events-auto",
          style: {
            willChange: "transform, opacity",
            transform: "translate3d(0, 0, 0)",
            backfaceVisibility: "hidden"
          },
          dir: "rtl",
          children: [r.jsx("div", {
            className: "p-4 pb-3 border-b border-slate-100 dark:border-slate-800/60",
            children: r.jsxs("div", {
              className: "flex items-center justify-between",
              children: [r.jsxs("div", {
                className: "flex items-center gap-2",
                children: [r.jsx("div", {
                  className: "w-10 h-10 rounded-xl flex items-center justify-center font-extrabold shrink-0 ".concat(ur(we) ? "text-slate-900" : "text-white"),
                  style: {
                    backgroundColor: we
                  },
                  children: r.jsx(Ha, {
                    className: "w-5 h-5"
                  })
                }), r.jsxs("div", {
                  className: "flex flex-col min-w-0",
                  children: [r.jsx("span", {
                    className: "text-xs font-black text-slate-900 dark:text-slate-100 truncate max-w-[105px]",
                    children: e ? e.name : "مدير الجراج"
                  }), r.jsx("span", {
                    className: "text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate",
                    children: e ? "موظف وردية" : "إدارة الجراج"
                  })]
                })]
              }), r.jsx("button", {
                type: "button",
                onClick: () => O(!1),
                className: "w-8 h-8 bg-red-500 dark:bg-red-600 text-white rounded-lg flex items-center justify-center hover:bg-red-600 dark:hover:bg-red-700 transition-colors outline-none shrink-0",
                children: r.jsx(Fs, {
                  className: "w-5 h-5"
                })
              })]
            })
          }), r.jsx("div", {
            className: "flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar-slate",
            children: r.jsxs("div", {
              className: "space-y-2",
              children: [!e && r.jsxs("button", {
                onClick: () => ys("subscribers"),
                className: "w-full flex items-center justify-between p-2.5 bg-[#faf9f6] dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border-2 border-slate-150 dark:border-slate-800 transition-all outline-none",
                children: [r.jsxs("div", {
                  className: "flex items-center gap-2.5",
                  children: [r.jsx("div", {
                    className: "w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-400/10 text-blue-500 flex items-center justify-center",
                    children: r.jsx(Xa, {
                      className: "w-4 h-4"
                    })
                  }), r.jsx("span", {
                    className: "font-bold text-sm",
                    children: "الأشتراكات"
                  })]
                }), ve > 0 && r.jsx("span", {
                  className: "px-2 py-0.5 rounded-md bg-red-600 text-white dark:bg-red-500 dark:text-slate-950 text-xs font-black",
                  children: ve
                })]
              }), !e && r.jsx("button", {
                onClick: () => ys("reports"),
                className: "w-full flex items-center justify-between p-2.5 bg-[#faf9f6] dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border-2 border-slate-150 dark:border-slate-800 transition-all outline-none animate-fade-in",
                children: r.jsxs("div", {
                  className: "flex items-center gap-2.5",
                  children: [r.jsx("div", {
                    className: "w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-400/10 text-purple-500 flex items-center justify-center",
                    children: r.jsx(uA, {
                      className: "w-4 h-4 text-purple-500"
                    })
                  }), r.jsx("span", {
                    className: "font-bold text-sm",
                    children: "التقارير الذكية"
                  })]
                })
              }), r.jsx("button", {
                onClick: () => ys("packages"),
                className: "w-full flex items-center justify-between p-2.5 bg-[#faf9f6] dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border-2 border-slate-150 dark:border-slate-800 transition-all outline-none",
                children: r.jsxs("div", {
                  className: "flex items-center gap-2.5",
                  children: [r.jsx("div", {
                    className: "w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-400/10 text-amber-500 flex items-center justify-center",
                    children: r.jsx(oo, {
                      className: "w-4 h-4 fill-current text-amber-500"
                    })
                  }), r.jsx("span", {
                    className: "font-bold text-sm",
                    children: "باقات الاشتراكات"
                  })]
                })
              }), !e && r.jsxs("button", {
                onClick: () => ys("rewards"),
                className: "w-full flex items-center justify-between p-2.5 bg-[#faf9f6] dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border-2 border-slate-150 dark:border-slate-800 transition-all outline-none animate-fade-in",
                children: [r.jsxs("div", {
                  className: "flex items-center gap-2.5",
                  children: [r.jsx("div", {
                    className: "w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-400/10 text-emerald-500 flex items-center justify-center",
                    children: r.jsx(Mf, {
                      className: "w-4 h-4 text-emerald-500"
                    })
                  }), r.jsx("span", {
                    className: "font-bold text-sm",
                    children: "المكافآت"
                  })]
                }), (t.referralBonusBalance || 0) > 0 && r.jsxs("span", {
                  className: "px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-xs font-black font-mono",
                  children: [t.referralBonusBalance, " ج.م"]
                })]
              }), r.jsxs("button", {
                onClick: () => ys("history"),
                className: "w-full flex items-center justify-between p-2.5 bg-[#faf9f6] dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border-2 border-slate-150 dark:border-slate-800 transition-all outline-none",
                children: [r.jsxs("div", {
                  className: "flex items-center gap-2.5",
                  children: [r.jsx("div", {
                    className: "w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-400/10 text-rose-500 flex items-center justify-center",
                    children: r.jsx(sA, {
                      className: "w-4 h-4 text-rose-500"
                    })
                  }), r.jsx("span", {
                    className: "font-bold text-sm",
                    children: "تاريخ الشحن"
                  })]
                }), ue && r.jsxs("span", {
                  className: "px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-black flex items-center gap-1",
                  children: [r.jsx("span", {
                    className: "w-1 h-1 bg-rose-500 rounded-full"
                  }), "شحن جديد"]
                })]
              }), r.jsx("button", {
                onClick: () => ys("appearance"),
                className: "w-full flex items-center justify-between p-2.5 bg-[#faf9f6] dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border-2 border-slate-150 dark:border-slate-800 transition-all outline-none",
                children: r.jsxs("div", {
                  className: "flex items-center gap-2.5",
                  children: [r.jsx("div", {
                    className: "w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-400/10 text-indigo-500 flex items-center justify-center",
                    children: r.jsx(yg, {
                      className: "w-4 h-4 text-indigo-500"
                    })
                  }), r.jsx("span", {
                    className: "font-bold text-sm",
                    children: "إعدادات المظهر"
                  })]
                })
              })]
            })
          }), r.jsx("div", {
            className: "p-3.5 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/40",
            children: r.jsxs("button", {
              onClick: () => {
                O(!1), E();
              },
              className: "w-full flex items-center justify-center gap-2.5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all font-black text-sm outline-none",
              children: [r.jsx(lo, {
                className: "w-5 h-5 rotate-180"
              }), r.jsx("span", {
                children: "تسجيل الخروج"
              })]
            })
          })]
        })]
      })
    }), r.jsxs("main", {
      className: "max-w-md md:max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto p-4 w-full flex-1 flex flex-col gap-4 md:gap-10 overscroll-contain overflow-y-auto ".concat(s ? "gap-3 pt-3 pb-3" : "gap-4"),
      children: [(!s || ie !== "main") && r.jsx("div", {
        className: "flex gap-4 shrink-0 w-full select-none",
        id: "persistent_balance_card",
        children: r.jsxs("div", {
          className: "flex-1 transition-all duration-300 py-2.5 md:py-6 px-4 md:px-10 rounded-[1.75rem] border flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden ".concat(L <= 1 ? "bg-red-600 dark:bg-red-700 border-red-700 dark:border-red-600 text-white shadow-md shadow-red-500/20" : L === 2 ? "bg-red-500/10 dark:bg-red-950/40 border-red-300 dark:border-red-800/80 text-red-600 dark:text-red-400" : Ae === "decrease" ? "border-red-500/50 shadow-[0_4px_24px_rgba(239,68,68,0.12)] bg-[#faf9f6] dark:bg-slate-900" : Ae === "increase" ? "border-emerald-500/50 shadow-[0_4px_24px_rgba(16,185,129,0.12)] bg-[#faf9f6] dark:bg-slate-900" : "bg-[#faf9f6] dark:bg-slate-900 border-slate-200 dark:border-slate-800"),
          children: [r.jsx(sS, {
            transitionType: Ae
          }), r.jsx("div", {
            className: "py-1 flex items-center justify-center overflow-visible z-10",
            children: r.jsxs("div", {
              className: "text-2xl md:text-4xl font-black transition-colors duration-300 flex items-center gap-2 ".concat(L <= 1 ? "text-white" : L === 2 || Ae === "decrease" ? "text-red-600 dark:text-red-400" : Ae === "increase" ? "text-emerald-600 dark:text-emerald-400" : We ? "text-red-500" : "text-slate-900 dark:text-slate-100"),
              children: [r.jsx("span", {
                children: "باقي"
              }), r.jsx("span", {
                className: "text-4xl md:text-7xl font-extrabold font-mono tracking-tight",
                children: r.jsx(tS, {
                  value: L,
                  disableColorChange: !0
                })
              }), r.jsx("span", {
                children: L === 1 ? "يوم" : L === 2 ? "يومين" : L >= 3 && L <= 10 ? "أيام" : "يوم"
              })]
            })
          }), We && r.jsx("p", {
            className: "text-[10px] md:text-sm font-black uppercase tracking-widest mt-1 transition-colors duration-300 z-10 ".concat(L <= 1 ? "text-white/90 font-black" : L === 2 || Ae === "decrease" ? "text-red-600 dark:text-red-400" : Ae === "increase" ? "text-emerald-600 dark:text-emerald-400" : L <= 0 ? "text-red-500" : "text-red-400"),
            children: Ds
          }), t.dailyCapacity !== void 0 && t.dailyCapacity > 0 && r.jsxs("div", {
            className: "mt-2 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full inline-flex items-center gap-1 z-10",
            children: [r.jsx("span", {
              children: "المسجل اليوم:"
            }), r.jsx("span", {
              className: "font-mono font-black text-amber-600 dark:text-amber-400",
              children: t.todayCount || 0
            }), r.jsx("span", {
              children: "من"
            }), r.jsx("span", {
              className: "font-mono font-black",
              children: t.dailyCapacity
            }), r.jsx("span", {
              children: "سيارة/يوم"
            })]
          })]
        })
      }), ie === "main" ? r.jsxs(r.Fragment, {
        children: [r.jsx(BO, {
          newPlateNumber: x,
          setNewPlateNumber: b,
          isInputFocused: s,
          setIsInputFocused: y,
          plateInputRef: k,
          vehicles: l,
          garage: t,
          handleCheckIn: T,
          onCheckOut: _e => {
            d(_e), h(!0);
          },
          closeKeyboard: m,
          inputRef: D,
          shimmerActive: !0,
          isBalanceOut: Ns
        }), !s && r.jsxs("div", {
          className: "bg-[#faf9f6] dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-[2rem] overflow-hidden flex flex-col items-center pt-4 md:pt-10 transition-colors w-full shadow-sm relative",
          children: [r.jsx("div", {
            onClick: () => H("active_vehicles"),
            className: "mb-4 md:mb-10 scale-100 md:scale-110 cursor-pointer",
            children: r.jsx(UO, {
              value: se,
              size: "lg"
            })
          }), r.jsx("button", {
            onClick: () => H("active_vehicles"),
            className: "w-full h-6 md:h-7 relative overflow-hidden group outline-none select-none flex items-center justify-center shrink-0 transition-colors",
            style: {
              backgroundColor: we
            },
            children: r.jsx("div", {
              className: "absolute inset-0 flex items-center justify-center z-20 pointer-events-none",
              children: r.jsx("div", {
                className: "w-7 h-7 md:w-8 h-8 rounded-full flex items-center justify-center border-2 shadow-md group-hover:scale-110 transition-all ".concat(ur(we) ? "text-slate-900" : "text-white"),
                style: {
                  backgroundColor: we,
                  borderColor: "".concat(we, "80")
                },
                children: r.jsx(If, {
                  className: "w-3.5 h-3.5 md:w-4 md:h-4 group-active:translate-y-0.5 transition-transform ".concat(ur(we) ? "text-slate-900" : "text-white")
                })
              })
            })
          })]
        })]
      }) : r.jsx(r.Fragment, {
        children: r.jsxs("div", {
          className: "bg-[#faf9f6] dark:bg-slate-900 rounded-[2rem] border border-slate-150 dark:border-slate-800 overflow-hidden flex flex-col flex-1 min-h-[400px] md:min-h-[500px] transition-colors w-full shadow-sm",
          children: [r.jsxs("div", {
            className: "p-3 md:p-4 px-4 md:px-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 shrink-0 transition-colors",
            children: [r.jsxs("div", {
              className: "flex items-center gap-3",
              children: [r.jsx("div", {
                className: "w-8 h-8 md:w-11 md:h-11 bg-slate-900 dark:bg-slate-800 rounded-lg flex items-center justify-center text-white transition-all",
                children: r.jsx(Da, {
                  className: "w-4 h-4 md:w-6 md:h-6"
                })
              }), r.jsx("div", {
                children: r.jsxs("h3", {
                  className: "font-black text-slate-900 dark:text-white text-sm md:text-lg uppercase tracking-tight",
                  children: ["إجمالى العدد ", se]
                })
              })]
            }), r.jsx("div", {
              className: "flex items-center gap-3",
              children: r.jsx("button", {
                onClick: () => H("main"),
                className: "w-8 h-8 md:w-11 md:h-11 bg-red-500 dark:bg-red-600 text-white rounded-xl flex shrink-0 items-center justify-center hover:bg-red-600 dark:hover:bg-red-700 transition-colors outline-none shadow-sm",
                children: r.jsx(Fs, {
                  className: "w-4 h-4 md:w-5 md:h-5"
                })
              })
            })]
          }), r.jsxs("div", {
            ref: Ft,
            className: "divide-y divide-slate-100 dark:divide-slate-800 flex-1 overflow-y-auto custom-scrollbar overscroll-contain touch-pan-y bg-[#faf9f6] dark:bg-slate-900 transition-colors",
            children: [ls.map(_e => r.jsx(GO, {
              vehicle: _e,
              onCheckOut: st => {
                m(), d(st), h(!0);
              }
            }, _e.id)), W < l.length && r.jsx("div", {
              ref: Wt,
              className: "py-8 flex justify-center items-center",
              children: r.jsx("div", {
                className: "w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"
              })
            }), l.length === 0 && r.jsxs("div", {
              className: "py-24 text-center",
              children: [r.jsx("div", {
                className: "w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100 dark:border-slate-800 transition-colors",
                children: r.jsx(Da, {
                  className: "w-10 h-10 text-slate-200 dark:text-slate-700"
                })
              }), r.jsx("p", {
                className: "text-slate-400 dark:text-slate-600 font-bold text-base md:text-lg",
                children: "لا توجد سيارات حالياً"
              }), !Ns && r.jsx("button", {
                onClick: () => H("main"),
                className: "mt-6 text-sm md:text-base font-black text-emerald-500 uppercase tracking-widest border-b-2 border-emerald-500/20 pb-0.5",
                children: "سجل دخول عربية جديدة"
              })]
            })]
          })]
        })
      }), r.jsxs("div", {
        className: "mt-auto mb-2 py-4 flex items-center justify-center gap-3 select-none text-slate-400 dark:text-slate-500 font-bold text-[10px] md:text-xs tracking-wider uppercase transition-all duration-300 ".concat(s || ie !== "main" ? "opacity-0 h-0 overflow-hidden pointer-events-none py-0 my-0" : "opacity-100"),
        children: [r.jsx("div", {
          className: "h-[1px] w-8 bg-gradient-to-l from-transparent to-slate-200 dark:to-slate-800"
        }), r.jsx("span", {
          className: "brand-shimmer-text",
          children: "ARQ FOR SOFTWARE DEVELOPMENT"
        }), r.jsx("div", {
          className: "h-[1px] w-8 bg-gradient-to-r from-transparent to-slate-200 dark:to-slate-800"
        })]
      })]
    }), ne && r.jsx("div", {
      className: "fixed inset-0 z-[90] bg-slate-900/95 flex items-center justify-center p-6 text-center",
      children: r.jsxs("div", {
        className: "max-w-sm w-full",
        children: [r.jsx("div", {
          className: "w-20 h-20 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-6",
          children: r.jsx(bg, {
            className: "w-10 h-10 text-red-500"
          })
        }), r.jsx("h2", {
          className: "text-2xl font-black text-white mb-3",
          children: "الجراج مغلق حالياً"
        }), r.jsxs("div", {
          className: "space-y-4 mb-8",
          children: [r.jsx("p", {
            className: "text-slate-400 text-sm font-medium leading-relaxed px-4",
            children: t.lockReason || "تم تعليق الخدمة مؤقتاً، يرجى التواصل مع الإدارة."
          }), r.jsxs("div", {
            className: "bg-white/5 border border-white/10 rounded-2xl p-4 inline-block",
            children: [r.jsx("p", {
              className: "text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1",
              children: "رقم الإدارة"
            }), r.jsx("p", {
              className: "text-xl font-black text-white font-mono tracking-widest",
              dir: "ltr",
              children: I
            })]
          })]
        })]
      })
    }), R && r.jsx(qO, {
      garage: t,
      onClose: () => j(!1),
      showToast: V,
      onToggleMenu: () => O(!_)
    }), z && r.jsx(FO, {
      garage: t,
      onClose: () => {
        X(!1), Te(!1);
      },
      showToast: V,
      onToggleMenu: () => O(!_)
    }), Y && r.jsx(nS, {
      packages: F,
      onClose: () => Q(!1),
      garageHourlyRate: t.hourlyRate,
      walletNumber: I,
      onToggleMenu: () => O(!_),
      billingModel: t.billingModel,
      subscriptionPrices: A,
      hasMonthlySubscribers: t.hasMonthlySubscribers
    }), os && r.jsx(aS, {
      garage: t,
      onClose: () => is(!1),
      onToggleMenu: () => O(!_),
      referralBonusBalance: t.referralBonusBalance || 0,
      showToast: V
    }), ce && !e && r.jsx($O, {
      staffList: q,
      vehiclesInside: l,
      todayExitedVehicles: c,
      onClose: () => te(!1),
      now: a,
      onToggleMenu: () => O(!_)
    }), Oe && !e && r.jsx(HO, {
      garage: t,
      vehiclesInside: l,
      todayExitedVehicles: c,
      staffList: q,
      onClose: () => ot(!1),
      onToggleMenu: () => O(!_)
    }), zt && r.jsx(ZT, {
      garage: t,
      currentStaff: e,
      onClose: () => Xt(!1),
      showToast: V,
      onToggleMenu: () => O(!_)
    }), ze && Re && r.jsx("div", {
      className: "fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 z-[110] flex items-center justify-center p-4 animate-none",
      onClick: $e,
      children: r.jsxs("div", {
        className: "w-full max-w-md bg-[#faf9f6] dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-xl p-6 shadow-2xl relative overflow-hidden",
        onClick: _e => _e.stopPropagation(),
        dir: "rtl",
        children: [r.jsx("div", {
          className: "absolute top-0 right-1/2 translate-x-1/2 w-48 h-48 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"
        }), r.jsx("button", {
          onClick: $e,
          className: "w-10 h-10 bg-red-500 text-white rounded-xl flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm outline-none",
          children: r.jsx(Fs, {
            className: "w-6 h-6"
          })
        }), r.jsxs("div", {
          className: "text-center mt-4",
          children: [r.jsx("div", {
            className: "w-16 h-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/20 dark:shadow-emerald-500/10",
            children: r.jsx(oo, {
              className: "w-8 h-8 fill-current"
            })
          }), r.jsx("h3", {
            className: "text-xl font-black text-slate-900 dark:text-white mb-2",
            children: "تم شحن الرصيد بنجاح!"
          }), r.jsx("p", {
            className: "text-xs font-bold text-slate-400 dark:text-slate-500 mb-6",
            children: "رصيد جديد مضاف إلى الحساب الخاص بالجراج"
          }), r.jsxs("div", {
            className: "bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4.5 text-right space-y-3.5 border border-slate-100 dark:border-slate-800/50 mb-6",
            children: [r.jsxs("div", {
              className: "flex justify-between items-start gap-4",
              children: [r.jsx("span", {
                className: "text-xs font-bold text-slate-400 dark:text-slate-500 flex-shrink-0",
                children: "اسم الباقة:"
              }), r.jsx("span", {
                className: "text-sm font-black text-slate-900 dark:text-white leading-tight text-left",
                children: Re.plateNumber
              })]
            }), r.jsx("div", {
              className: "w-full border-t border-slate-200/40 dark:border-slate-850/40"
            }), r.jsxs("div", {
              className: "flex justify-between items-center",
              children: [r.jsx("span", {
                className: "text-xs font-bold text-slate-400 dark:text-slate-500",
                children: "القيمة المالية:"
              }), r.jsx("span", {
                className: "text-base font-black text-emerald-600 dark:text-emerald-400 font-mono",
                children: Re.amount !== void 0 ? "".concat(Re.amount, " ج.م") : "مجانية"
              })]
            }), r.jsx("div", {
              className: "w-full border-t border-slate-200/40 dark:border-slate-850/40"
            }), r.jsxs("div", {
              className: "flex justify-between items-center",
              children: [r.jsx("span", {
                className: "text-xs font-bold text-slate-400 dark:text-slate-500",
                children: "الوقت والتاريخ:"
              }), r.jsxs("span", {
                className: "text-xs font-black text-slate-700 dark:text-slate-300",
                children: [$t(Re.timestamp), " - ", Ye(Re.timestamp)]
              })]
            }), Re.staffName && r.jsxs(r.Fragment, {
              children: [r.jsx("div", {
                className: "w-full border-t border-slate-200/40 dark:border-slate-850/40"
              }), r.jsxs("div", {
                className: "flex justify-between items-center",
                children: [r.jsx("span", {
                  className: "text-xs font-bold text-slate-400 dark:text-slate-500",
                  children: "بواسطة:"
                }), r.jsx("span", {
                  className: "text-xs font-black text-slate-700 dark:text-slate-300",
                  children: Re.staffName.includes("مدير النظام") || Re.staffName.toLowerCase().includes("admin") ? "مدير النظام" : Re.staffName
                })]
              })]
            })]
          }), r.jsx("button", {
            onClick: $e,
            className: "w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 px-6 rounded-2xl font-black text-sm transition-all shadow-lg shadow-emerald-600/10 dark:shadow-emerald-600/5 uppercase tracking-wider block",
            children: "إغلاق النافذة"
          })]
        })]
      })
    }), Ps && r.jsx("div", {
      className: "fixed inset-0 bg-slate-900/70 dark:bg-slate-950/85 z-[120] flex items-center justify-center p-4 animate-fade-in",
      onClick: hs,
      children: r.jsxs("div", {
        className: "w-full max-w-md bg-white dark:bg-slate-900 border-2 border-red-500/30 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden text-right",
        onClick: _e => _e.stopPropagation(),
        dir: "rtl",
        children: [r.jsx("div", {
          className: "absolute top-0 right-1/2 translate-x-1/2 w-48 h-48 bg-red-500/10 rounded-full blur-2xl pointer-events-none"
        }), r.jsx("button", {
          onClick: hs,
          className: "absolute top-4 left-4 w-9 h-9 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full flex items-center justify-center transition-colors outline-none",
          children: r.jsx(Fs, {
            className: "w-5 h-5"
          })
        }), r.jsxs("div", {
          className: "text-center mt-2",
          children: [r.jsx("div", {
            className: "w-16 h-16 bg-red-500/15 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20 shadow-sm",
            children: r.jsx(xu, {
              className: "w-8 h-8"
            })
          }), r.jsx("h3", {
            className: "text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-2",
            children: "تنبيه انتهاء الاشتراك"
          }), r.jsx("p", {
            className: "text-sm md:text-base font-black text-red-600 dark:text-red-400 mb-4 leading-relaxed bg-red-50 dark:bg-red-950/40 p-4 rounded-2xl border border-red-200 dark:border-red-900/50 shadow-inner",
            children: "إشتراكك هينتهى النهاردة الحق اشحن قبل الساعة 5 علشان تقدر تكمل شغل"
          }), r.jsx("p", {
            className: "text-xs font-bold text-slate-500 dark:text-slate-400 mb-6 leading-relaxed",
            children: "يرجى طلب تجديد الاشتراك من باقات الاشتراكات مع المندوب الخاص بك لتجنب توقف الخدمة."
          }), r.jsxs("div", {
            className: "flex flex-col gap-2.5",
            children: [r.jsx("button", {
              onClick: () => {
                hs(), Q(!0);
              },
              className: "w-full bg-red-600 hover:bg-red-700 text-white py-3.5 px-6 rounded-2xl font-black text-sm md:text-base transition-all shadow-lg shadow-red-600/20 uppercase tracking-wider block outline-none",
              children: "طلب تجديد الاشتراك الآن"
            }), r.jsx("button", {
              onClick: hs,
              className: "w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-3 px-6 rounded-2xl font-bold text-xs transition-all outline-none",
              children: "تذكيري لاحقاً"
            })]
          })]
        })]
      })
    })]
  });
})