-- =========================================================================
-- ASTANA IT UNIVERSITY - ICT COURSE (WEEK 8)
-- ASSIGNMENT 4: COMPETITION-READY PROJECT PACKAGE
-- "Smart Technology, Data and the ICT Best Project"
-- PROJECT: L-EASY (AUDIO RECOGNITION-CENTRIC LECTURE ASSISTANT)
-- AUTHORS: Auelbek Zhibek, Klenov Askhat, Amangeldinov Yeraly
-- TARGET SYSTEM: POSTGRESQL 15 (SUPABASE CLOUD)
-- LIVE INSTANCE: https://qcathxqziocmdjqflrsv.supabase.co
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- 1. CORE TABLES (FROM ASSIGNMENT 3)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    subject VARCHAR(100) DEFAULT 'General Studies',
    audio_path TEXT,
    duration INTEGER CHECK (duration >= 0),
    transcript TEXT,
    summary JSONB DEFAULT '{}'::jsonb,
    study JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id UUID NOT NULL REFERENCES public.recordings(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_index SMALLINT NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
    explanation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id UUID NOT NULL REFERENCES public.recordings(id) ON DELETE CASCADE,
    term VARCHAR(150) NOT NULL,
    definition TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- 2. NEW ASSIGNMENT 4 TABLES: SMART SENSOR TELEMETRY & CJM SUPPORT LOGS
-- =========================================================================

DROP TABLE IF EXISTS public.journey_support_logs CASCADE;
DROP TABLE IF EXISTS public.smart_audio_telemetry CASCADE;

-- 2.1 Smart Classroom Acoustic Telemetry Table (Task 4.1 & 4.3)
-- Captures real-time acoustic environment metrics from Web Audio API / Smart Mic
CREATE TABLE public.smart_audio_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id UUID NOT NULL REFERENCES public.recordings(id) ON DELETE CASCADE,
    ambient_noise_db NUMERIC(5,2) NOT NULL CHECK (ambient_noise_db BETWEEN 0 AND 140),
    snr_db NUMERIC(5,2) NOT NULL,
    speech_rate_wpm SMALLINT NOT NULL CHECK (speech_rate_wpm BETWEEN 0 AND 400),
    noise_filter_active BOOLEAN NOT NULL DEFAULT true,
    acoustic_zone VARCHAR(30) NOT NULL CHECK (acoustic_zone IN ('Quiet (<45dB)', 'Moderate (45-60dB)', 'Noisy (>60dB)')),
    device_type VARCHAR(60) NOT NULL DEFAULT 'Web Audio Smart Mic',
    processing_latency_ms INTEGER NOT NULL CHECK (processing_latency_ms >= 0),
    asr_accuracy_pct NUMERIC(5,2) NOT NULL CHECK (asr_accuracy_pct BETWEEN 0 AND 100),
    quiz_score_pct NUMERIC(5,2) NOT NULL CHECK (quiz_score_pct BETWEEN 0 AND 100),
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 Customer Journey Usage & Support Tickets Table (Task 4.2 & 4.3)
-- Tracks user onboarding, sensor calibration alerts, and Stage 5 support events
CREATE TABLE public.journey_support_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    recording_id UUID REFERENCES public.recordings(id) ON DELETE SET NULL,
    cjm_stage SMALLINT NOT NULL CHECK (cjm_stage BETWEEN 1 AND 5),
    event_type VARCHAR(80) NOT NULL,
    issue_description TEXT NOT NULL,
    resolution_status VARCHAR(40) NOT NULL DEFAULT 'resolved',
    task_time_sec INTEGER CHECK (task_time_sec >= 0),
    sus_score NUMERIC(4,1) CHECK (sus_score BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- B-Tree Indexes for Foreign Keys and RLS Performance
CREATE INDEX IF NOT EXISTS idx_recordings_user_id ON public.recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_recording_id ON public.quiz_questions(recording_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_recording_id ON public.flashcards(recording_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_recording_id ON public.smart_audio_telemetry(recording_id);
CREATE INDEX IF NOT EXISTS idx_journey_user_id ON public.journey_support_logs(user_id);

-- =========================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES FOR NEW TABLES
-- =========================================================================

ALTER TABLE public.smart_audio_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_support_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own smart telemetry" ON public.smart_audio_telemetry
    FOR ALL TO authenticated
    USING (recording_id IN (SELECT id FROM public.recordings WHERE user_id = (select auth.uid())));

CREATE POLICY "Users access own journey support logs" ON public.journey_support_logs
    FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- =========================================================================
-- 4. SEED DATA FOR SMART AUDIO TELEMETRY (20 LECTURE SESSIONS - TASK 4 DATA)
-- =========================================================================

INSERT INTO public.smart_audio_telemetry (
    recording_id, ambient_noise_db, snr_db, speech_rate_wpm, noise_filter_active,
    acoustic_zone, device_type, processing_latency_ms, asr_accuracy_pct, quiz_score_pct
) VALUES
-- Quiet Lecture Halls (<45 dB)
('11111111-1111-1111-1111-111111111101', 38.4, 22.5, 118, true,  'Quiet (<45dB)',      'Laptop Array Mic',    1120, 97.2, 92.5),
('11111111-1111-1111-1111-111111111102', 41.2, 20.8, 124, true,  'Quiet (<45dB)',      'Smartphone MEMS Mic', 1180, 96.5, 90.0),
('11111111-1111-1111-1111-111111111103', 39.0, 21.9, 115, true,  'Quiet (<45dB)',      'BLE Lapel Smart Mic',  980, 97.8, 95.0),
('11111111-1111-1111-1111-111111111104', 43.5, 19.4, 130, true,  'Quiet (<45dB)',      'Smartphone MEMS Mic', 1240, 95.4, 88.0),
('11111111-1111-1111-1111-111111111105', 37.1, 23.1, 112, false, 'Quiet (<45dB)',      'Laptop Array Mic',    1090, 95.1, 89.5),
('11111111-1111-1111-1111-111111111106', 40.3, 21.0, 122, true,  'Quiet (<45dB)',      'BLE Lapel Smart Mic', 1020, 96.8, 92.0),

-- Moderate Classrooms (45-60 dB)
('11111111-1111-1111-1111-111111111107', 48.6, 17.2, 128, true,  'Moderate (45-60dB)', 'Smartphone MEMS Mic', 1310, 94.6, 88.5),
('11111111-1111-1111-1111-111111111108', 51.4, 16.0, 134, true,  'Moderate (45-60dB)', 'Laptop Array Mic',    1390, 93.9, 87.0),
('11111111-1111-1111-1111-111111111101', 54.2, 15.1, 138, true,  'Moderate (45-60dB)', 'Smartphone MEMS Mic', 1420, 93.2, 86.5),
('11111111-1111-1111-1111-111111111102', 57.8, 14.3, 142, true,  'Moderate (45-60dB)', 'BLE Lapel Smart Mic', 1280, 94.1, 89.0),
('11111111-1111-1111-1111-111111111103', 49.5, 16.5, 126, true,  'Moderate (45-60dB)', 'Laptop Array Mic',    1350, 94.0, 88.0),
('11111111-1111-1111-1111-111111111104', 55.9, 10.2, 140, false, 'Moderate (45-60dB)', 'Smartphone MEMS Mic', 1480, 85.4, 78.0),
('11111111-1111-1111-1111-111111111105', 52.3, 15.6, 131, true,  'Moderate (45-60dB)', 'Smartphone MEMS Mic', 1360, 93.5, 86.0),

-- Noisy Auditorium / Lab (>60 dB) — Comparing Smart Filter ON vs OFF
('11111111-1111-1111-1111-111111111106', 63.4, 13.8, 145, true,  'Noisy (>60dB)',      'BLE Lapel Smart Mic', 1490, 92.1, 85.5),
('11111111-1111-1111-1111-111111111107', 66.8, 12.6, 150, true,  'Noisy (>60dB)',      'Smartphone MEMS Mic', 1560, 90.8, 83.5),
('11111111-1111-1111-1111-111111111108', 69.1, 11.9, 154, true,  'Noisy (>60dB)',      'Laptop Array Mic',    1620, 89.9, 82.0),
('11111111-1111-1111-1111-111111111101', 64.7, 13.2, 148, true,  'Noisy (>60dB)',      'Smartphone MEMS Mic', 1510, 91.5, 85.0),
('11111111-1111-1111-1111-111111111102', 65.5,  6.1, 149, false, 'Noisy (>60dB)',      'Laptop Array Mic',    1710, 78.2, 70.0),
('11111111-1111-1111-1111-111111111103', 68.9,  5.2, 156, false, 'Noisy (>60dB)',      'Smartphone MEMS Mic', 1790, 75.8, 67.5),
('11111111-1111-1111-1111-111111111104', 71.2,  4.8, 162, false, 'Noisy (>60dB)',      'Smartphone MEMS Mic', 1840, 75.1, 68.0);

-- Seed Customer Journey & Usability Test Logs (8 records across 5 CJM stages)
INSERT INTO public.journey_support_logs (
    user_id, recording_id, cjm_stage, event_type, issue_description,
    resolution_status, task_time_sec, sus_score
) VALUES
('506b9097-0669-4d36-b520-1ce4c000118c', '11111111-1111-1111-1111-111111111101', 1, 'onboarding_demo',       'Visitor opened link without login via QR code',            'resolved', 78, 87.5),
('506b9097-0669-4d36-b520-1ce4c000118c', '11111111-1111-1111-1111-111111111102', 2, 'pwa_install',           'Student opened mobile web app on iOS Safari',              'resolved', 82, 85.0),
('506b9097-0669-4d36-b520-1ce4c000118c', '11111111-1111-1111-1111-111111111103', 3, 'mic_calibration',       'Auto-enabled Biquad noise filter when hall exceeded 60dB', 'resolved', 85, 82.5),
('506b9097-0669-4d36-b520-1ce4c000118c', '11111111-1111-1111-1111-111111111104', 4, 'daily_lecture_capture', 'Generated RU/KZ summary and 8 flashcards in 1.4s',         'resolved', 79, 87.5),
('506b9097-0669-4d36-b520-1ce4c000118c', '11111111-1111-1111-1111-111111111105', 4, 'active_recall_quiz',    'Completed 8-question self-check quiz with explanation',    'resolved', 96, 80.0),
('506b9097-0669-4d36-b520-1ce4c000118c', '11111111-1111-1111-1111-111111111106', 5, 'transcript_edit',       'Student edited domain formula in Summary and synced DB',   'resolved', 84, 85.0),
('506b9097-0669-4d36-b520-1ce4c000118c', '11111111-1111-1111-1111-111111111107', 5, 'high_noise_ticket',     'Echo in Room B204 triggered recommendation for lapel mic', 'resolved', 88, 82.5),
('506b9097-0669-4d36-b520-1ce4c000118c', '11111111-1111-1111-1111-111111111108', 5, 'pdf_export_sync',       'Exported bilingual lecture notes to PDF for final exam',   'resolved', 80, 86.0);

-- =========================================================================
-- 5. TASK 4.3 BONUS QUERY: MULTI-TABLE TELEMETRY & LEARNING IMPACT ANALYSIS
-- =========================================================================

SELECT
    t.acoustic_zone,
    t.noise_filter_active,
    COUNT(t.id) AS lecture_sessions,
    ROUND(AVG(t.ambient_noise_db), 1) AS avg_ambient_db,
    ROUND(AVG(t.snr_db), 1) AS avg_snr_db,
    ROUND(AVG(t.asr_accuracy_pct), 1) AS avg_asr_accuracy_pct,
    ROUND(AVG(t.quiz_score_pct), 1) AS avg_quiz_score_pct,
    ROUND(AVG(t.processing_latency_ms), 0) AS avg_latency_ms
FROM public.smart_audio_telemetry t
INNER JOIN public.recordings r ON r.id = t.recording_id
GROUP BY t.acoustic_zone, t.noise_filter_active
ORDER BY avg_ambient_db ASC, t.noise_filter_active DESC;
