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

## Food data sources

| Source | What it is | How reliable |
|---|---|---|
| USDA FoodData Central — Foundation + SR Legacy | Lab-analysed generic foods (US). Public domain. | Reference quality. SR Legacy is what most consumer apps use for generic foods. |
| TACO 4ª ed. (NEPA/UNICAMP, 2011) | Brazilian Food Composition Table: 597 foods analysed in Brazil (feijão, arroz, mandioca, frutas…). Reproduction allowed with citation. | Reference quality. Trace amounts ("Tr") are stored as 0. A few foods have no energy or macros in the table (fluid cow's milk, salt) and are left out; USDA covers milk. |
| IBGE POF 2008–2009 household measures | Grams per colher de sopa, concha, escumadeira, unidade… for each TACO food. | Official survey averages; your spoon may differ. |
| Moqueca de peixe (receita calculada) | TACO has no moqueca. It is calculated from TACO ingredients: cação 800 g, tomate 300 g, cebola 200 g, pimentões 200 g, leite de coco 200 g, dendê 30 g, limão 30 g, with 10 % water lost in cooking. | An estimate for a typical Bahian recipe. TBCA (USP) has measured preparations but offers no download. |
| USDA Branded Foods (barcode, US/Canada) | Nutrition facts submitted by manufacturers, by GTIN/UPC. | Label data, as reliable as the label (labels may round, and US rules allow ±20 %). |
| Open Food Facts (barcode, everywhere else) | A crowd-sourced database of product labels, strong in Brazil and Europe. | Volunteer data. Usually right, but the app tells you to check it against the label. There is no open official barcode database for Brazil or Ireland. |

The barcode number itself is checked before any lookup: the last digit of an EAN/UPC is a mod-10 checksum (digits weighted 3, 1, 3, 1… from the right). A camera misread almost always breaks it.

## Calories burned by exercise

| Rule in the app | Why | Source |
|---|---|---|
| kcal = MET × body weight × hours, using MET values from the Compendium of Physical Activities | The standard reference for the energy cost of activities. The 2024 update lists 1,114 activities, most with measured values. | Research: [Herrmann et al. 2024](https://pubmed.ncbi.nlm.nih.gov/38242596/) |
| Walking and running with a distance use the ACSM metabolic equations (speed and incline), so pace counts. Cycling with a distance uses the Compendium's speed bands. | Speed-based equations are better than one fixed value per activity, but still carry roughly 8–24 % error, and more outside their intended speed range. | [ACSM equations (summary)](https://www.depts.ttu.edu/ksm/_documents/grad/acsm_comps/6a_Formulas_for_Met_Calucations-Table_7.3.pdf); validation: [cadence-based equations, MSSE 2021](https://pubmed.ncbi.nlm.nih.gov/32555022/) |
| Results are shown as a range (±20 % for equations, ±30 % for MET tables) | Even wrist-worn devices were off by 27–93 % for energy expenditure in a Stanford study. | Research: [Shcherbina et al. 2017 (Stanford)](https://pubmed.ncbi.nlm.nih.gov/28538708/) |
| Extra (unplanned) activity adds only its *net* calories (above resting) to the day's food budget. Planned sessions add nothing, because they're already in the activity level behind your targets. | This avoids counting resting energy twice and double-counting planned training. | Energy-balance principle |

## Sport & functional programs

| Program element | Why | Source |
|---|---|---|
| **Boxing:** lower-body strength (heavy squats) and power (jumps, light loaded jump squats), rotational power, shoulder and neck robustness, bag and shadow rounds | Lower-limb power was strongly associated with punch impact in national-team boxers. Gains from jump squats and half squats transferred to punch force. Leg fatigue lowers punch force, so heavy leg work stays away from sparring. | Research: [Loturco et al. 2016](https://pubmed.ncbi.nlm.nih.gov/26110348/); [Loturco et al. 2021](https://ro.ecu.edu.au/ecuworkspost2013/11164); [fatigue study](https://pubmed.ncbi.nlm.nih.gov/33858296/) |
| **Football:** Nordic hamstring curls twice a week | Programs with Nordics roughly halve hamstring injuries (RCTs: risk ratio 0.52). | Research: [van Dyk et al. 2019, *BJSM*](https://bjsm.bmj.com/content/53/21/1362.info) |
| **Football:** Copenhagen adductor planks | The Adductor Strengthening Programme cut groin problems by 41 % in a cluster-randomised trial. | Research: [Harøy et al. 2019, *BJSM*](https://bjsm.bmj.com/content/53/3/150.info) |
| **Football:** FIFA 11+ warm-up recommended before team training | It reduces injuries by about 30–40 % in meta-analyses. | Research: [Thorborg et al. 2017, *BJSM*](https://pubmed.ncbi.nlm.nih.gov/28087568/) |
| **Football / athletic:** jumps, bounds and repeated sprints | Plyometric training improves jumping, sprinting and change of direction in team-sport athletes. Repeated-sprint training is included with modest expectations; evidence for improving repeated-sprint ability itself is thin. | Research: [Ramirez-Campillo et al. (basketball)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9729929/); [handball 2024](https://pubmed.ncbi.nlm.nih.gov/38455436/); [Clemente et al. 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC7967484/) |
| **Running:** heavy strength (3–6 reps) and plyometrics, 2×/week for 10+ weeks | Strength training improves running economy. Heavy loads beat plyometrics alone, and effects grow over 10+ weeks. | Research: [Balsalobre-Fernández et al. 2016](https://pubmed.ncbi.nlm.nih.gov/26694507/); [Eihara et al. 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9653533/); [Llanos-Lagos et al. 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11052887/) |
| **Swimming:** pulling strength, leg power for starts and turns, light high-rep rotator-cuff work | Swimming plus strength training outperforms swimming alone. Dryland external-rotator work improves rotator strength and balance, a modifiable risk factor for swimmer's shoulder. Evidence for reducing injury incidence itself is limited. | Research: [Crowley et al. 2017](https://link.springer.com/doi/10.1007/s40279-017-0730-2); [Fone & van den Tillaar 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8804114/); [swimmer's-shoulder exercise review 2022](https://pubmed.ncbi.nlm.nih.gov/35735465/) |
| **All sport programs:** gradual progression, neuromuscular work (strength, balance, agility), strength for hamstrings, quads, hips, core, neck and back | General injury-prevention guidance. | [Johns Hopkins Medicine](https://www.hopkinsmedicine.org/health/conditions-and-diseases/sports-injuries/female-athletes-common-sports-injuries-prevention); [5 tips for preventing sports injuries](https://www.hopkinsmedicine.org/health/conditions-and-diseases/sports-injuries/5-tips-for-preventing-sports-related-injuries) |
| Power work: low reps, full rest (2 min), stop when speed drops, done before fatiguing work | Standard power-training practice: quality of movement and velocity are the stimulus. | Practice |

On university sources: Johns Hopkins Medicine's sports-medicine guidance is used above. I didn't find program-level training research published by Oxford or Cambridge themselves. The strongest sport-specific evidence is in peer-reviewed journals (*BJSM*, *Sports Medicine*, *JSCR*) and governing-body programmes (FIFA 11+), so those are the sources used.

## Choosing the week (deterministic programs, decided by data)

Every week of every program is pre-designed. The review only chooses which week runs next.

**The options:**
- **Progress:** the next step of the program.
- **Repeat:** the same loading again.
- **Lighter:** pull a lighter week forward.
- **Condensed:** the same progression in fewer, longer sessions.
- **Skip lighter week:** go straight into the next block.

The same choice always produces the same sessions.

**The signals:**
- **Adherence:** sessions done ÷ sessions due over 14 days.
- **Strength trend:** estimated 1-rep max, using Epley: kg × (1 + reps/30), comparing each lift's latest session with the one before.
- **Weeks since the last lighter week.**

**The rules, applied in order:**

| # | Signal | Choice |
|---|---|---|
| 1 | Adherence < 50 % | Condensed |
| 2 | Adherence < 75 % | Repeat |
| 3 | Poor recovery in the last 7 days (≥ 3 check-ins: average sleep < 6 h, energy ≤ 2 or soreness ≥ 4) | Lighter |
| 3b | ≥ 2 lifts down, and more down than up | Lighter |
| 4 | 6+ weeks without a lighter week | Lighter |
| 5 | A lighter week is scheduled, but adherence ≥ 90 %, lifts are climbing and recovery is fine | Skip it (lighter weeks don't add muscle by themselves — Coleman 2024) |
| 6 | Otherwise | Progress |

The AI coach sees the same data and the rule-based pick. It can only choose among these options, and you can overrule it with a tap.

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

## Ranks (Villager → Zeus): training points

Ranks are earned by training, logged in the diary (`src/domain/xp.ts`):

- **Aerobic:** 1 point per hour.
- **Weight training:** each set scores 0.1 × difficulty × effort.
  - Difficulty runs from 1.3 (squat, deadlift, clean) through 1.0 (bench, rows, pull-ups) and 0.7 (isolation) down to 0.4–0.5 (core and prehab).
  - Effort = (load ÷ the exercise's standard working weight for your body weight × reps ÷ 8)^0.75, kept between 0.2 and 2.
  - A challenging hour of ~20 hard sets earns about 2 points.
- **Daily cap:** 6 points.
- **36 ranks in 7 tiers:**
  - Villager: Villager → Blacksmith
  - Hardman: Hunter → Pankratiast
  - Soldier: Recruit → Captain
  - General: Commander → King
  - Champion: Athlete of Olympia → Living legend
  - Semi-god: Perseus, Theseus, Achilles, Heracles
  - God: Hermes, Apollo, Artemis, Ares, Athena, Hades, Poseidon, Zeus
- **Exponential thresholds:** points(n) = A·(rⁿ − 1). The first rank costs 3 points. Zeus is set at the reference athlete's 7-year total: 5 challenging lifting sessions plus 1 hour of aerobic work every day is 17 points/week, so 7 × 52.18 × 17 ≈ 6,209 points. That gives r ≈ 1.185: each rank costs ~18.5 % more than the previous one. A test simulates the 7 years.

## The objective (body composition)

Progress = (lean mass gained + fat lost) ÷ (lean mass needed + fat to lose), measured from your body when you set the objective. Each part is capped at what was needed.

The default objective is a normalised FFMI of 22.5 at 11 % body fat for men, or 18.5 at 19 % for women. FFMI (fat-free mass index) is lean mass ÷ height², normalised for height (Kouri et al., 1995). These targets sit near the upper end of what is reachable without drugs.

The timeline uses practitioner estimates of lean-mass gain by training age: roughly 0.7 / 0.35 / 0.15 kg per month for newer, intermediate and advanced men, and about half that for women. These are rules of thumb, not promises.
