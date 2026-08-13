const fs = require('fs');

let code = fs.readFileSync('decompiled.tsx', 'utf8');

// Replace standard hooks and React
code = code.replace(/be\.useState/g, 'useState');
code = code.replace(/be\.useEffect/g, 'useEffect');
code = code.replace(/be\.useMemo/g, 'useMemo');
code = code.replace(/be\.useCallback/g, 'useCallback');
code = code.replace(/be\.useRef/g, 'useRef');
code = code.replace(/C\.memo/g, 'memo');
code = code.replace(/qr\(\)/g, 'useTheme()');
code = code.replace(/r\.Fragment/g, 'React.Fragment');

const replacements = {
  '<BO ': '<RegistrationCard ',
  '</BO>': '</RegistrationCard>',
  '<UO ': '<FlipNumber ',
  '</UO>': '</FlipNumber>',
  '<qO ': '<SubscribersView ',
  '</qO>': '</SubscribersView>',
  '<FO ': '<RechargeHistoryView ',
  '</FO>': '</RechargeHistoryView>',
  '<nS ': '<PackagesModal ',
  '</nS>': '</PackagesModal>',
  '<aS ': '<RewardsModal ',
  '</aS>': '</RewardsModal>',
  '<$O ': '<StaffStatsModal ',
  '</$O>': '</StaffStatsModal>',
  '<HO ': '<GarageReportsView ',
  '</HO>': '</GarageReportsView>',
  '<ZT ': '<AppearanceSettingsModal ',
  '</ZT>': '</AppearanceSettingsModal>',
  '<Ka.div': '<motion.div',
  '</Ka.div>': '</motion.div>',
  '<Dc>': '<AnimatePresence>',
  '</Dc>': '</AnimatePresence>',
  '<sS ': '<MovingBalanceArrows ',
  '</sS>': '</MovingBalanceArrows>',
  '<tS ': '<AnimatedCounter ',
  '</tS>': '</AnimatedCounter>',
  '<bg ': '<AlertTriangle ',
  '<lo ': '<LogOut ',
  '<oo ': '<Zap ',
  '<uA ': '<PieChart ',
  '<Mf ': '<Gift ',
  '<sA ': '<Clock ',
  '<yg ': '<Sliders ',
  '<xu ': '<AlertTriangle ',
  '<Fs ': '<X ',
  '<Xa ': '<Users ',
  '<cE ': '<Menu ',
};

for (const [key, value] of Object.entries(replacements)) {
  code = code.split(key).join(value);
}

// Prefix with imports
const prefix = `import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LogOut, Car, XCircle, Menu, X, Users, Zap, ChevronDown, 
  Bell, PieChart, Sliders, AlertTriangle, Gift, Clock
} from 'lucide-react';
import { FlipNumber } from '../ui/FlipNumber';
import { AnimatedCounter } from '../AnimatedCounter';
import { useTheme } from '../../context/ThemeContext';
import { useShimmerColor, isLightColor } from '../../hooks/useShimmerColor';
import { auth, db } from '../../lib/firebase';
import * as firebaseService from '../../lib/firebase';
import { RegistrationCard } from './RegistrationCard';
import { VehicleItem } from './VehicleItem';
import { SubscribersView } from './SubscribersView';
import { GarageReportsView } from './GarageReportsView';
import { RechargeHistoryView } from './RechargeHistoryView';
import { PackagesModal } from '../modals/PackagesModal';
import { RewardsModal } from '../modals/RewardsModal';
import { StaffStatsModal } from '../modals/StaffStatsModal';
import { AppearanceSettingsModal } from '../modals/AppearanceSettingsModal';
import { MovingBalanceArrows } from './MovingBalanceArrows';
import { format } from 'date-fns';

// Helper functions (mocked or extracted from minified)
const uo = useShimmerColor;
const qr = useTheme;
const ur = isLightColor;
const pt = (ts) => ts && ts.toDate ? ts.toDate() : new Date(ts);
const Ac = (g) => g.balance || 0; // rough approximation for Ke
const Qt = auth;
const me = firebaseService;

export const GarageDashboardView = `;

code = prefix + code;

// Fix closing
code = code.replace(/KO = memo/g, 'memo');

fs.writeFileSync('src/components/garage/GarageDashboardView.tsx', code);
