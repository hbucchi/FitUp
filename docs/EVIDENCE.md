# How Micenae's training and nutrition are designed

Every rule in the programs (`src/domain/programs.ts`), the nutrition plan (`src/domain/nutritionPlan.ts`) and the weekly update (`src/domain/reschedule.ts`, `src/agent/review.ts`) traces to a source below.

**Evidence levels.** *Research* means peer-reviewed studies, mostly meta-analyses. *Practice* means widely used coaching heuristics, such as Renaissance Periodization, Stronger By Science and natural-bodybuilding coaches. Those fill gaps where research is thin, and they are labelled as such.

This is coaching guidance, not medical advice.

## Training

| Rule in the app | Why | Source |
|---|---|---|
| ~10–20 hard sets per muscle per week. Programs start near 8–11 and build to 11–15 (Upper/Lower) or 13–19 (PPL). | More weekly sets produce more growth, with diminishing returns. ≥10 sets/week clearly outperforms <5. | Research: [Schoenfeld, Ogborn & Krieger 2017](https://doi.org/10.1080/02640414.2016.1210197) (meta-analysis); Pelland, Remmert, Robinson, Hinson & Zourdos 2024, SportRxiv preprint (dose-response meta-regressions of volume and frequency; not yet peer reviewed) |
| Each muscle trained ~2×/week | At equal weekly volume, frequency adds little; it mainly spreads the volume so each session stays productive. | Research: Pelland et al. 2024 |
| Rep ranges rotate weekly: Heavy (6–8), Moderate (8–12), Light (10–15); isolations go higher | Muscle growth is similar from ~6 to 30 reps when sets are hard. Heavier work favours strength. Undulating rep ranges give a small strength edge and keep training fresh. | Research: [Lopez et al. 2021](https://pubmed.ncbi.nlm.nih.gov/33433148/) (network meta-analysis); [Moesgaard et al. 2022](https://pubmed.ncbi.nlm.nih.gov/35044672/) (periodization meta-analysis) |
| Effort climbs through each block: 3 → 2 → 1 reps in reserve (RIR). Isolations reach ~0 RIR in the final week. Compounds never go to failure. | Training to failure gives at most a trivial extra benefit for size, and costs more fatigue. Hypertrophy improves the closer you get to failure, while strength depends on it less. | Research: [Refalo et al. 2023](https://pubmed.ncbi.nlm.nih.gov/36334240/); Robinson et al. 2024 (*Sports Medicine*) |
| Sets added week to week within a block, then a lighter week | Mesocycles start near minimum effective volume (MEV) and add ~1 set per muscle per week toward maximum recoverable volume (MRV). | Practice: [Renaissance Periodization volume landmarks](https://rpstrength.com/training-volume-landmarks-muscle-growth/) |
| Lighter week after each 3–5-week block, only in programs >4 weeks. Short programs skip it. | In one trial, a mid-program week off didn't change muscle growth and slightly reduced lower-body strength. The lighter week is kept for fatigue and joint management, not as a growth booster, and stays short. | Research: [Coleman et al. 2024](https://peerj.com/articles/16777) |
| Main lifts change each block; accessories every 2 weeks | Moderate, *planned* variation helps regional growth. Excessive or random rotation can hinder progress. | Research: [Kassiano et al. 2022](https://pubmed.ncbi.nlm.nih.gov/35438660/) (systematic review) |
| Rest 2–3 min on compounds, ~90 s on isolations | Rest under ~60 s slightly reduces growth (it cuts the load you can lift). Beyond ~90 s there's no detectable difference. | Research: [Singer et al. 2024](https://pubmed.ncbi.nlm.nih.gov/39205815/) (Bayesian meta-analysis) |
| Exercise picks favour long muscle lengths: overhead triceps extension, incline curls, seated leg curls, Romanian deadlifts | Overhead triceps work grew the triceps substantially more than pushdowns. Several studies favour training at long muscle lengths, though evidence is mixed for some muscles. | Research: [Maeo et al. 2023](https://pubmed.ncbi.nlm.nih.gov/35819335/); [Wolf et al. 2025](https://peerj.com/articles/18904). Practice/caveats: [Stronger By Science](https://www.strongerbyscience.com/stretch-mediated-hypertrophy/) |
| Double progression: when every set hits the top of the rep range at the target RIR, add weight | Standard progressive-overload method. | Practice |
| Cut program: same lifting structure, loads kept heavy, ≥1 RIR, plus easy cardio (cycling / incline walking, 25 → 40 min, 2×/week) | Keeping heavy loads while dieting maintains the signal to keep muscle. Running interfered with lifting gains more than cycling in an older meta-analysis, though a 2021 meta-analysis found little interference overall. | Research: [Helms et al. 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492); Wilson et al. 2012 (*JSCR*); Schumann et al. 2022 (*Sports Medicine*) |

## Nutrition

| Rule in the app | Why | Source |
|---|---|---|
| Maintenance = Katch–McArdle BMR (from lean mass) × activity | Uses your body-fat estimate, so it is more accurate for lean or muscular people than weight-only formulas. | Standard equation |
| Cut: −0.5 % body weight/week (−0.75 % if body fat is higher). Never planned faster than ~1 %/week. | 0.5–1 %/week maximises muscle retention. Slower loss (0.7 %/wk) gained lean mass while faster loss (1.4 %/wk) did not. | Research: [Helms, Aragon & Fitschen 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492); Garthe et al. 2011 (*Int J Sport Nutr Exerc Metab*) |
| Build: +0.3 / +0.2 / +0.1 % per week (novice / intermediate / advanced), surplus capped at 15 % | Modest surpluses (~10–20 %) are recommended. In trained lifters, a 15 % surplus mostly added fat without more muscle than 5 % or maintenance. | Research: [Iraki et al. 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6680710); [Helms et al. 2023](https://pubmed.ncbi.nlm.nih.gov/37914977/) |
| Recomposition: maintenance calories | — | — |
| Protein: build/recomp 2.2 g/kg lean mass (≥1.6 g/kg body weight); cut 2.6 g/kg lean mass | Gains in fat-free mass plateau around 1.6 g/kg/day (upper confidence limit ~2.2). In a deficit, 2.3–3.1 g/kg lean mass is recommended (later updated to ~1.8–2.7 g/kg). | Research: [Morton et al. 2018](https://pubmed.ncbi.nlm.nih.gov/28698222/); Helms 2014; Roberts et al. 2020 |
| Fat 22 % (cut) / 27 % of energy, never below 0.6 g/kg | Fat at 15–30 % of calories in contest prep. The 0.6 g/kg floor is a common practice guard for hormonal health. | Research: Helms 2014. Practice: floor |
| Carbohydrate fills the rest, with a little more on training days (same weekly total) | Carbs fuel hard training. The training/rest split is for performance and adherence; it has no proven body-composition effect of its own. | Practice |
| 4 meals, ~0.4–0.55 g/kg protein each; protein + carbs before and after training | Four meals at 0.4 g/kg reach ≥1.6 g/kg/day; up to 0.55 g/kg per meal at higher intakes. Pre/post-training protein (0.4–0.5 g/kg) covers any nutrient-timing benefit. | Research: [Schoenfeld & Aragon 2018](https://pubmed.ncbi.nlm.nih.gov/29497353/); Helms 2014 |
| Fiber 14 g per 1000 kcal | — | Dietary Guidelines for Americans |
| Creatine monohydrate 3–5 g/day | Strong evidence for strength and training adaptations; safe long-term in healthy people. | Research: [Kreider et al. 2017 (ISSN position stand)](https://pubmed.ncbi.nlm.nih.gov/28615996/) |
| No planned diet breaks | In resistance-trained adults, intermittent diet breaks didn't improve body composition versus continuous dieting. One-week breaks improved muscular endurance. | Research: [Peos et al. 2021 (ICECAP)](https://pubmed.ncbi.nlm.nih.gov/33587549/) |

## The weekly "Update"

**Training.** It looks back over the last 15 days. Misses from earlier weeks are closed rather than chased, because chasing them piles up fatigue and next week covers those muscles anyway.

Misses from the current week move to the next free day, preferring your training days, in their original order. Two sessions never share a day, and the app avoids three lifting days in a row when possible. Sessions that don't fit are skipped. With an AI key, the coach can also fold a missed session's main lifts into another day or trim volume. Its tools only allow dates from today to Sunday and at most 30 sets per session.

**Nutrition.** It looks back over the last 10 days and changes targets *only if necessary*:

1. **Not enough data:** if fewer than 5 days were fully logged, or there are fewer than 3 weigh-ins spanning a week, nothing changes.
2. **On track:** if the weight trend (a regression across weigh-ins) is within ±0.25 %/week of target (±0.15 when building), nothing changes.
3. **Intake off target:** if intake averaged more than 10 % away from target, nothing changes; the fix is hitting the current targets.
4. **Otherwise,** calories change by half the measured gap, capped at ±200 kcal, through carbohydrate. One kilogram of body mass is treated as ~7700 kcal.
5. **Losing faster than 1.2 %/week** always adds calories, to protect muscle.

With an AI key, the coach sees all of this as a baseline. Its own changes are capped at ±300 kcal, protein must stay between 1.6 g/kg body weight and 3.1 g/kg lean mass, and fat must stay ≥0.6 g/kg and ≥20 % of calories.

## Ranks (Villager → God)

Progress = (lean mass gained + fat lost) ÷ (lean mass needed + fat to lose), measured from your body when you set the objective. Each part is capped at what was needed. The ranks start at Villager (0 %) and move through Hardman (15 %), Soldier (35 %), General (55 %), Champion (75 %) and Semi-god (90 %) to God, at 100 %, when the objective is reached.

The default objective is a normalised FFMI of 22.5 at 11 % body fat for men, or 18.5 at 19 % for women. FFMI (fat-free mass index) is lean mass ÷ height², normalised for height (Kouri et al., 1995). These targets sit near the upper end of what is reachable without drugs.

The timeline uses practitioner estimates of lean-mass gain by training age: roughly 0.7 / 0.35 / 0.15 kg per month for newer, intermediate and advanced men, and about half that for women. These are rules of thumb, not promises.
