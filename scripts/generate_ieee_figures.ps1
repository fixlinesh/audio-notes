Add-Type -AssemblyName System.Drawing

$outDir = "c:\Users\amang\audio-notes\figures"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-Canvas([int]$w, [int]$h) {
    $bmp = [System.Drawing.Bitmap]::new($w, $h)
    $bmp.SetResolution(300, 300)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.Color]::White)
    return @{ Bmp = $bmp; G = $g }
}

function Draw-Arrow($g, $basePen, [float]$x1, [float]$y1, [float]$x2, [float]$y2, [string]$label = "", $font = $null, [float]$lxOffset = 0, [float]$lyOffset = 0) {
    $pen = $basePen.Clone()
    $cap = [System.Drawing.Drawing2D.AdjustableArrowCap]::new(6, 7, $true)
    $pen.CustomEndCap = $cap
    $g.DrawLine($pen, $x1, $y1, $x2, $y2)
    $pen.Dispose()
    if ($label -ne "" -and $null -ne $font) {
        $sf = [System.Drawing.StringFormat]::new()
        $sf.Alignment = [System.Drawing.StringAlignment]::Center
        $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
        $mx = ($x1 + $x2) / 2 + $lxOffset
        $my = ($y1 + $y2) / 2 + $lyOffset
        $sz = $g.MeasureString($label, $font)
        $bgRect = [System.Drawing.RectangleF]::new($mx - $sz.Width / 2 - 4, $my - $sz.Height / 2 - 1, $sz.Width + 8, $sz.Height + 2)
        $g.FillRectangle([System.Drawing.Brushes]::White, $bgRect)
        $g.DrawString($label, $font, [System.Drawing.Brushes]::Black, $mx, $my, $sf)
    }
}

function Draw-Box($g, [float]$x, [float]$y, [float]$w, [float]$h, [string]$title, [string[]]$lines, $hdrColor, $borderColor, $fTitle, $fBody) {
    $hdrH = 48
    $rect = [System.Drawing.RectangleF]::new($x, $y, $w, $h)
    $hdrRect = [System.Drawing.RectangleF]::new($x, $y, $w, $hdrH)

    $bgBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(250, 251, 253))
    $hdrBrush = [System.Drawing.SolidBrush]::new($hdrColor)
    $borderPen = [System.Drawing.Pen]::new($borderColor, 2.4)

    $g.FillRectangle($bgBrush, $rect)
    $g.FillRectangle($hdrBrush, $hdrRect)
    $g.DrawRectangle($borderPen, $x, $y, $w, $h)
    $g.DrawLine($borderPen, $x, $y + $hdrH, $x + $w, $y + $hdrH)

    $sfCenter = [System.Drawing.StringFormat]::new()
    $sfCenter.Alignment = [System.Drawing.StringAlignment]::Center
    $sfCenter.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString($title, $fTitle, [System.Drawing.Brushes]::White, [System.Drawing.RectangleF]::new($x + 6, $y + 2, $w - 12, $hdrH - 4), $sfCenter)

    $curY = $y + $hdrH + 14
    $stepY = ($h - $hdrH - 22) / [Math]::Max(1, $lines.Count)
    foreach ($ln in $lines) {
        $g.DrawString($ln, $fBody, [System.Drawing.Brushes]::Black, [System.Drawing.RectangleF]::new($x + 14, $curY, $w - 24, $stepY + 4))
        $curY += $stepY
    }
}

# ==============================================================================
# FIGURE 1: 4-TIER ARCHITECTURE DIAGRAM (1280 x 720 px, crisp for IEEE column)
# ==============================================================================
$c1 = New-Canvas 1280 720
$g1 = $c1.G

$fTitle1 = [System.Drawing.Font]::new("Times New Roman", 21, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fBody1  = [System.Drawing.Font]::new("Times New Roman", 18, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$fArrow1 = [System.Drawing.Font]::new("Times New Roman", 16, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

$navy   = [System.Drawing.Color]::FromArgb(20, 45, 90)
$teal   = [System.Drawing.Color]::FromArgb(15, 76, 92)
$slate  = [System.Drawing.Color]::FromArgb(45, 55, 72)
$dark   = [System.Drawing.Color]::FromArgb(30, 41, 59)

$bw = 524; $bh = 250
$xL = 24; $xR = 732
$yT = 26; $yB = 424

# Tier 1: Top Left
Draw-Box $g1 $xL $yT $bw $bh "Tier 1: Smart Client Edge (PWA)" @(
    "- React 19 + TypeScript 5.7 + Vite 8",
    "- getUserMedia (EC/NS/AGC = false)",
    "- AnalyserNode (N=2048): dBFS & SNR_bb",
    "- 2nd-Order Biquad HPF (120 Hz, Q=0.707)",
    "- Dynamic pdfjs-dist & Web Speech TTS"
) $navy $navy $fTitle1 $fBody1

# Tier 2: Top Right
Draw-Box $g1 $xR $yT $bw $bh "Tier 2: Serverless API Gate (Vercel)" @(
    "- Node.js Functions (HTTPS / TLS 1.3)",
    "- Endpoints: /transcribe, /summarize",
    "- Endpoints: /study, /chat (4.5 MB cap)",
    "- Supabase JWT Auth & Guest Preview",
    "- 3-Model Fallback + Secret Key Isolation"
) $slate $slate $fTitle1 $fBody1

# Tier 4: Bottom Left (Cloud DB)
Draw-Box $g1 $xL $yB $bw $bh "Tier 4: Cloud Data Layer (Supabase)" @(
    "- PostgreSQL 15 (6 Normalized Tables)",
    "- PostgreSQL Row-Level Security (RLS)",
    "- Scalar (select auth.uid()) = user_id",
    "- Private Media Bucket ('audio')",
    "- Time-Limited Signed Storage URLs"
) $teal $teal $fTitle1 $fBody1

# Tier 3: Bottom Right (AI & Benchmark)
Draw-Box $g1 $xR $yB $bw $bh "Tier 3: AI Synthesis & Benchmark" @(
    "- Google Gemini 3.5 / 3.8 Flash",
    "- Strict responseSchema JSON Contract",
    "- Synchronized EN / RU / KZ Study Notes",
    "- 8-Item Quiz (Fisher-Yates) & AI Tutor",
    "- Whisper Large-v3-Turbo & Base Baselines"
) $dark $dark $fTitle1 $fBody1

$arrowPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(30, 30, 30), 3.0)

# T1 -> T2
Draw-Arrow $g1 $arrowPen ($xL + $bw) ($yT + $bh/2) $xR ($yT + $bh/2) "HTTPS Audio/PDF" $fArrow1 0 -22
# T2 -> T3
Draw-Arrow $g1 $arrowPen ($xR + $bw/2) ($yT + $bh) ($xR + $bw/2) $yB "Schema-Locked JSON API" $fArrow1 105 0
# T1 -> T4
Draw-Arrow $g1 $arrowPen ($xL + $bw/2) ($yT + $bh) ($xL + $bw/2) $yB "PostgREST + JWT" $fArrow1 78 0
# T3 -> T4 (JSON persistence via client/API)
Draw-Arrow $g1 $arrowPen $xR ($yB + $bh/2) ($xL + $bw) ($yB + $bh/2) "Persist / RLS Sync" $fArrow1 0 -22

$c1.Bmp.Save((Join-Path $outDir "fig1_architecture.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$g1.Dispose()
$c1.Bmp.Dispose()

# ==============================================================================
# FIGURE 2: 6-TABLE POSTGRESQL 15 ERD (1280 x 880 px, crisp for IEEE column)
# ==============================================================================
$c2 = New-Canvas 1280 880
$g2 = $c2.G

$fTitle2 = [System.Drawing.Font]::new("Times New Roman", 20, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fBody2  = [System.Drawing.Font]::new("Courier New", 16, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fRel2   = [System.Drawing.Font]::new("Times New Roman", 15, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

function Draw-Entity($g, [float]$x, [float]$y, [float]$w, [float]$h, [string]$name, [string[]]$cols, $fTitle, $fCol) {
    $hdrH = 42
    $hdrColor = [System.Drawing.Color]::FromArgb(20, 45, 90)
    $borderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(30, 41, 59), 2.2)

    $g.FillRectangle([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(248, 250, 252)), $x, $y, $w, $h)
    $g.FillRectangle([System.Drawing.SolidBrush]::new($hdrColor), $x, $y, $w, $hdrH)
    $g.DrawRectangle($borderPen, $x, $y, $w, $h)
    $g.DrawLine($borderPen, $x, $y + $hdrH, $x + $w, $y + $hdrH)

    $sf = [System.Drawing.StringFormat]::new()
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString($name, $fTitle, [System.Drawing.Brushes]::White, [System.Drawing.RectangleF]::new($x + 4, $y + 2, $w - 8, $hdrH - 4), $sf)

    $curY = $y + $hdrH + 10
    $step = ($h - $hdrH - 16) / [Math]::Max(1, $cols.Count)
    foreach ($col in $cols) {
        $g.DrawString($col, $fCol, [System.Drawing.Brushes]::Black, [System.Drawing.RectangleF]::new($x + 12, $curY, $w - 20, $step + 2))
        $curY += $step
    }
}

$ew = 530
$colL = 35; $colR = 715

# Row 1
Draw-Entity $g2 $colL 25 $ew 185 "auth.users (Supabase Auth)" @(
    "PK  id : uuid",
    "    email : varchar(255)",
    "    raw_user_meta_data : jsonb",
    "    created_at : timestamptz"
) $fTitle2 $fBody2

Draw-Entity $g2 $colR 25 $ew 245 "public.recordings" @(
    "PK  id : uuid",
    "FK  user_id : uuid -> auth.users",
    "    title, subject : varchar",
    "    duration : int | storage_path",
    "    transcript : text",
    "    summary, study : jsonb"
) $fTitle2 $fBody2

# Row 2
Draw-Entity $g2 $colL 325 $ew 240 "public.smart_audio_telemetry" @(
    "PK  id : uuid",
    "FK  recording_id : uuid -> recordings",
    "FK  user_id : uuid -> auth.users",
    "    rms_dbfs, snr_bb_db : numeric",
    "    biquad_hpf_hz : int (120/off)",
    "    asr_wer_pct : numeric"
) $fTitle2 $fBody2

Draw-Entity $g2 $colR 325 $ew 210 "public.journey_support_logs" @(
    "PK  id : uuid",
    "FK  user_id : uuid -> auth.users",
    "FK  recording_id : uuid -> recordings",
    "    cjm_stage : smallint (1..5)",
    "    task_time_sec, sus_score : num"
) $fTitle2 $fBody2

# Row 3
Draw-Entity $g2 $colL 635 $ew 195 "public.flashcards" @(
    "PK  id : uuid",
    "FK  recording_id : uuid -> recordings",
    "    term : varchar(150)",
    "    definition : text | mastered"
) $fTitle2 $fBody2

Draw-Entity $g2 $colR 635 $ew 195 "public.quiz_questions" @(
    "PK  id : uuid",
    "FK  recording_id : uuid -> recordings",
    "    question_text : text",
    "    options : jsonb | correct_idx"
) $fTitle2 $fBody2

$relPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(30, 41, 59), 2.6)

# Bottom connectors via clean vertical corridor (colGap center = 640)
$spineX = 640

# auth.users -> recordings (1:N CASCADE)
Draw-Arrow $g2 $relPen ($colL + $ew) 115 $colR 115 "1:N CASCADE" $fRel2 0 -18

# auth.users -> smart_audio_telemetry (RLS ownership)
Draw-Arrow $g2 $relPen ($colL + 130) 210 ($colL + 130) 325 "1:N (RLS Owner)" $fRel2 68 0

# recordings -> journey_support_logs
Draw-Arrow $g2 $relPen ($colR + 360) 270 ($colR + 360) 325 "1:N CJM Log" $fRel2 56 0

# recordings -> spine -> smart_audio_telemetry (orthogonal 1:N Telemetry)
$g2.DrawLine($relPen, $colR, 235, $spineX, 235)
$g2.DrawLine($relPen, $spineX, 235, $spineX, 445)
Draw-Arrow $g2 $relPen $spineX 445 ($colL + $ew) 445 "" $fRel2

$sfMid = [System.Drawing.StringFormat]::new()
$sfMid.Alignment = [System.Drawing.StringAlignment]::Center
$g2.FillRectangle([System.Drawing.Brushes]::White, 582, 286, 116, 24)
$g2.DrawString("1:N Telemetry", $fRel2, [System.Drawing.Brushes]::Black, 640, 290, $sfMid)

# spine continues dashed to flashcards & quiz_questions (stopping cleanly at y=732)
$dashPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(51, 65, 85), 2.2)
$dashPen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
$g2.DrawLine($dashPen, $spineX, 445, $spineX, 732)
Draw-Arrow $g2 $relPen $spineX 732 ($colL + $ew) 732 "" $fRel2
Draw-Arrow $g2 $relPen $spineX 732 $colR 732 "" $fRel2

$g2.FillRectangle([System.Drawing.Brushes]::White, 580, 602, 120, 24)
$g2.DrawString("1:N CASCADE", $fRel2, [System.Drawing.Brushes]::Black, 640, 606, $sfMid)

$c2.Bmp.Save((Join-Path $outDir "fig2_erd.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$g2.Dispose()
$c2.Bmp.Dispose()

Write-Output "Generated figures cleanly in $outDir"
