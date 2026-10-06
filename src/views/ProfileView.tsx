import React, { useState } from 'react';
import {
  User,
  Award,
  Flame,
  Zap,
  Save,
  Check,
  Shield,
  Calendar,
  Copy,
  Info,
} from 'lucide-react';
import { UserProfile, CEFRLevel, LearningGoal } from '../types';
import { cefrToSimplifiedLevel } from '../utils/learningEngine';
import { playChime } from '../utils/speech';
import { AuthService } from '../services/authService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';

interface ProfileViewProps {
  user: UserProfile;
  setUser: (user: UserProfile) => void;
  onOpenAuth?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ user, setUser, onOpenAuth }) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [learningGoal, setLearningGoal] = useState<LearningGoal>(user.learningGoal || user.primaryGoal || 'Everyday Fluency');
  const [englishLevel, setEnglishLevel] = useState<CEFRLevel>(user.englishLevel || user.targetLevel || 'B1');
  const [dailyPracticeGoal, setDailyPracticeGoal] = useState<number>(user.dailyPracticeGoal || user.dailyGoalMinutes || 15);
  const [saved, setSaved] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  const isGuest = !user.isLoggedIn || user.isGuest;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      ...user,
      name: name.trim(),
      email: email.trim(),
      learningGoal,
      primaryGoal: learningGoal,
      englishLevel,
      simplifiedLevel: cefrToSimplifiedLevel(englishLevel),
      targetLevel: englishLevel,
      dailyPracticeGoal: Number(dailyPracticeGoal),
      dailyGoalMinutes: Number(dailyPracticeGoal),
    };
    setUser(updated);
    AuthService.updateUserProfile(updated);
    playChime('success');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const copyUid = () => {
    if (user.uid || user.id) {
      navigator.clipboard.writeText(user.uid || user.id);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  const formattedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'September 2026';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        icon={User}
        title="Learner Profile & Goals"
        description="Manage your account identity, CEFR proficiency benchmarks, and daily study targets."
        badge="Account"
      />

      {/* Guest Notice Banner */}
      {isGuest && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                You are currently exploring in Guest Mode
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Sign in or register to permanently synchronize streaks, vocabulary banks, and progress analytics across devices.
              </p>
            </div>
          </div>
          {onOpenAuth && (
            <Button
              variant="primary"
              size="xs"
              onClick={onOpenAuth}
              className="shrink-0 bg-amber-600 hover:bg-amber-700 border-none"
            >
              Sign In / Register
            </Button>
          )}
        </div>
      )}

      {/* Profile Overview Card */}
      <Card>
        <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-18 h-18 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-2xl shadow-xs shrink-0 overflow-hidden">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              user.name ? user.name.charAt(0).toUpperCase() : 'G'
            )}
          </div>

          <div className="space-y-1.5 text-center sm:text-left flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {user.name || 'Guest Learner'}
              </h3>
              <Badge variant="primary" size="sm" className="mx-auto sm:mx-0">
                CEFR {user.englishLevel || user.targetLevel} Learner
              </Badge>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {user.email ? user.email : 'Guest Session (Local Storage)'}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3.5 pt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <span className="flex items-center space-x-1">
                <Flame className={`w-3.5 h-3.5 ${user.streakDays > 0 ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
                <span>{user.streakDays || 0}d streak</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Zap className="w-3.5 h-3.5 text-indigo-500" />
                <span>{user.totalXp || 0} XP</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Award className="w-3.5 h-3.5 text-emerald-500" />
                <span>{user.wordsMasteredCount || 0} words</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1 text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                <span>Joined {formattedDate}</span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Details & Identifiers */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <CardTitle className="text-sm">Account Details & Identifiers</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
              <span className="text-slate-500 dark:text-slate-400 font-medium">User Identifier (UID)</span>
              <div className="flex items-center justify-between font-mono text-[11px] text-slate-800 dark:text-slate-200">
                <span className="truncate mr-2">{user.uid || user.id || 'guest_user'}</span>
                <button
                  type="button"
                  onClick={copyUid}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title="Copy UID"
                >
                  {copiedUid ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Account Status</span>
              <div className="flex items-center justify-between pt-0.5">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {user.isLoggedIn && !user.isGuest ? 'Verified Learner' : 'Guest Account'}
                  </span>
                  <Badge variant={user.isLoggedIn && !user.isGuest ? 'success' : 'default'} size="sm">
                    {user.isLoggedIn && !user.isGuest ? 'Active' : 'Unregistered'}
                  </Badge>
                </div>
                {(!user.isLoggedIn || user.isGuest) && onOpenAuth && (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="text-xs font-semibold text-[#6D6FF2] hover:underline cursor-pointer"
                  >
                    Sign In / Register
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Form */}
      <form onSubmit={handleSave}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Learning Preferences & Profile Customization</CardTitle>
            <CardDescription className="text-xs">Adjust your focus and study frequency</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                id="profile-name-input"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <Input
                label="Email Address"
                type="email"
                id="profile-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="learner@example.com"
              />

              <Select
                label="Primary Learning Goal"
                id="profile-goal-select"
                value={learningGoal}
                onChange={(e) => setLearningGoal(e.target.value as LearningGoal)}
              >
                <option value="Speaking">Speaking Fluency & Vocal Confidence</option>
                <option value="Writing">Professional Writing & Clear Communication</option>
                <option value="Grammar">Grammar Precision & Error Eradication</option>
                <option value="Vocabulary">Vocabulary Mastery & Idiomatic Power</option>
                <option value="General English">General English (Comprehensive Skills)</option>
                <option value="Everyday Fluency">Everyday Fluency & Conversational Confidence</option>
                <option value="Workplace & Career">Workplace & Career Communication</option>
                <option value="IELTS / TOEFL">IELTS / TOEFL Exam Success</option>
                <option value="Academic">Academic Writing & University English</option>
                <option value="Travel">Travel & Overseas Relocation</option>
              </Select>

              <Select
                label="Target CEFR Proficiency"
                id="profile-level-select"
                value={englishLevel}
                onChange={(e) => setEnglishLevel(e.target.value as CEFRLevel)}
              >
                <option value="A1">A1 - Beginner</option>
                <option value="A2">A2 - Elementary</option>
                <option value="B1">B1 - Intermediate</option>
                <option value="B2">B2 - Upper Intermediate</option>
                <option value="C1">C1 - Advanced Professional</option>
                <option value="C2">C2 - Bilingual Mastery</option>
              </Select>

              <div className="space-y-2 sm:col-span-2 pt-1">
                <div className="flex justify-between items-center">
                  <label htmlFor="profile-practice-slider" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Daily Practice Commitment
                  </label>
                  <Badge variant="primary" size="sm">
                    {dailyPracticeGoal} Minutes / Day
                  </Badge>
                </div>
                <input
                  id="profile-practice-slider"
                  type="range"
                  min={5}
                  max={60}
                  step={5}
                  value={dailyPracticeGoal}
                  onChange={(e) => setDailyPracticeGoal(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>5 mins (Micro)</span>
                  <span>15 mins (Standard)</span>
                  <span>30 mins (Intensive)</span>
                  <span>60 mins (Immersion)</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="submit"
                id="save-profile-btn"
                variant="primary"
                size="md"
                leftIcon={saved ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
              >
                {saved ? 'Changes Saved!' : 'Save Profile Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};
