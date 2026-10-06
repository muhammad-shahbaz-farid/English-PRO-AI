import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Moon,
  Sun,
  Volume2,
  Languages,
  Trash2,
  RotateCcw,
  Check,
  Shield,
} from 'lucide-react';
import { AppSettings } from '../types';
import { playTextToSpeech } from '../utils/speech';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';

interface SettingsViewProps {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  onResetAllData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  setSettings,
  onResetAllData,
}) => {
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [notification, setNotification] = useState('');

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 2500);
  };

  const handleTestSpeech = () => {
    playTextToSpeech(
      `Hello! This is a test of your EnglishPro AI coach speaking with a ${settings.accentPreference} accent.`,
      {
        accent: settings.accentPreference,
        rate: settings.speechRate,
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        icon={SettingsIcon}
        title="Application Preferences"
        description="Configure voice accents, audio feedback, bilingual assistance, and storage options."
        badge="System"
      />

      {notification && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold text-center animate-in fade-in duration-150">
          {notification}
        </div>
      )}

      {/* Visual & Theme Preferences */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-2">
            <Sun className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <CardTitle className="text-sm">Appearance & Interface Theme</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
            <div>
              <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                Interface Color Mode
              </h5>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Switch between high-contrast dark mode and clean daylight theme.
              </p>
            </div>

            <div className="flex rounded-xl bg-slate-200/80 dark:bg-slate-800 p-1 border border-slate-300/40 dark:border-slate-700">
              <button
                onClick={() => {
                  setSettings({ ...settings, theme: 'light', darkMode: false });
                  showNotification('Theme set to Light Mode');
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  !settings.darkMode
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Light</span>
              </button>
              <button
                onClick={() => {
                  setSettings({ ...settings, theme: 'dark', darkMode: true });
                  showNotification('Theme set to Dark Mode');
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  settings.darkMode
                    ? 'bg-slate-900 text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Dark</span>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Voice & Speech Synthesis Settings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center space-x-2">
            <Volume2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <CardTitle className="text-sm">Voice Coach & Speech Engine</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={handleTestSpeech}
            leftIcon={<Volume2 className="w-3.5 h-3.5" />}
          >
            Test Coach Voice
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Target Accent Model
              </label>
              <Select
                value={settings.accentPreference}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    accentPreference: e.target.value as any,
                  })
                }
              >
                <option value="American">American (US Standard)</option>
                <option value="British">British (RP Standard)</option>
                <option value="Australian">Australian</option>
                <option value="Indian">Indian / Subcontinental</option>
              </Select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Primary listening model used during conversation synthesis.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Audio Playback Speed
                </label>
                <Badge variant="primary" size="sm">
                  {settings.speechRate}x
                </Badge>
              </div>
              <input
                type="range"
                min={0.7}
                max={1.3}
                step={0.1}
                value={settings.speechRate}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    speechRate: Number(e.target.value),
                  })
                }
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0.7x (Slower)</span>
                <span>1.0x (Natural)</span>
                <span>1.3x (Fast)</span>
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2.5 pt-2">
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                  Auto-Play AI Voice Responses
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Automatically read roleplay responses aloud when received in conversations.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoPlayVoice}
                onChange={(e) =>
                  setSettings({ ...settings, autoPlayVoice: e.target.checked })
                }
                className="w-4 h-4 accent-indigo-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                  Audio Chimes & XP Sound Feedback
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Play subtle affirmative chimes upon submitting challenges or earning points.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.soundEffects}
                onChange={(e) =>
                  setSettings({ ...settings, soundEffects: e.target.checked })
                }
                className="w-4 h-4 accent-indigo-600 rounded"
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Bilingual Urdu Learning Features */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-2">
            <Languages className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <CardTitle className="text-sm">Bilingual Urdu Learning Bridge</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <label className="flex items-center justify-between p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-800/60 cursor-pointer">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Show Urdu Explanations & Notes (اردو رہنمائی)
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Display Urdu grammar explanations, vocabulary translations, and Roman Urdu transcriptions.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.showUrduAssistance}
              onChange={(e) =>
                setSettings({ ...settings, showUrduAssistance: e.target.checked })
              }
              className="w-4 h-4 accent-purple-600 rounded shrink-0 ml-4"
            />
          </label>
        </CardContent>
      </Card>

      {/* Danger Zone / Reset Data */}
      <Card className="border-rose-200/80 dark:border-rose-900/60">
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-2">
            <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <CardTitle className="text-sm text-rose-600 dark:text-rose-400">Data Storage & Session Reset</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40">
            <div>
              <h5 className="text-sm font-semibold text-slate-900 dark:text-white">
                Reset Local Practice Data
              </h5>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Clear saved conversation transcripts, cached exercises, and reset streaks back to default.
              </p>
            </div>

            {!resetConfirmOpen ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResetConfirmOpen(true)}
                className="text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/60 shrink-0"
              >
                Reset All Data
              </Button>
            ) : (
              <div className="flex items-center space-x-2 shrink-0">
                <Button
                  variant="danger"
                  size="xs"
                  onClick={() => {
                    onResetAllData();
                    setResetConfirmOpen(false);
                    showNotification('All application data reset to initial clean state.');
                  }}
                >
                  Confirm Reset
                </Button>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => setResetConfirmOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
