# research: mas shevach (capital gains tax)

> ### ממצא מכריע מהמקור הרשמי - 2026-09-21
>
> **ה-PM חילץ את הוראת ביצוע מיסוי מקרקעין 2/2024 מ-`gov.il`.** ציטוט מילולי:
>
> > "להלן סכום תקרת הפטור לתקופה שבין יום כ' טבת התשפ"ד (1.1.2024) עד ליום
> > ל' כסלו התשפ"ה (31.12.2024) - 5,008,000 ש"ח"
>
> **התקרה תקפה לשנת 2024 בלבד.** זו הוראת ביצוע **שנתית** שכותרתה "עדכון הסכומים
> בחוק מיסוי מקרקעין ותקנות מס רכישה". כלומר **הסכום מתעדכן כל שנה**.
>
> **גם המחקר וגם האימות טעו** כשקבעו "תקף 2024-2027" ו"עד 15.1.2028.
> המקור הרשמי סותר את שניהם.
>
> **המשמעות:** 5,008,000 ₪ הוא מספר **מיושן בשנתיים**. אסור להציג אותו כתקרה
> נוכחית. צריך את הוראת הביצוע של 2026. ניסיון לנחש את ה-URL שלה נכשל (404),
> ונדרש חיפוש ממוקד ב-`gov.il`.
>
> **מה כן אומת מילולית מהמסמך הרשמי:** קיום סעיף 49א(א1), קיום מנגנון תקרת
> פטור, וקיום סעיף 49ה. **מספרים - אף אחד לא תקף להיום.**


> ### תוצאות סבב האימות, 2026-09-21
>
> **`taxes.gov.il` לא נגיש לקריאה אוטומטית** (connection reset). ה-PM הוריד בעצמו
> את הוראת ביצוע 2/2024 מ-`gov.il` - הקובץ אמיתי (147KB, PDF תקין) ונייר המכתבים
> חולץ בהצלחה ("רשות המסים בישראל"), אבל **גוף המסמך מקודד ב-CID ולא נחלץ** בלי
> ספריית PDF שלא הותקנה.
>
> **לכן אף מספר כאן אינו `verified`.** מה שכן: **כל חמשת המספרים עקביים לחלוטין
> בין כל המקורות שנבדקו, ללא סתירה אחת.**
>
> | # | ערך | בסיס | verified |
> |---|---|---|---|
> | שיעור מס על שבח ריאלי | 25% | סעיף 48א(ב1), עקביות מלאה | **לא** |
> | חיתוך לחישוב לינארי | 1.1.2014 | סעיף 48א(ב2), עקביות מלאה | **לא** |
> | תקרת פטור דירה יחידה | 5,008,000 ₪ | הוראת ביצוע 2/2024, kolzchut | **לא** |
> | החזקה מינימלית לפטור | 18 חודשים | סעיף 49ב(2), kolzchut | **לא** |
> | ספירה בדירה על הנייר | מיום טופס 4 | סעיף 49ב(2), kolzchut | **לא** |
>
> **תיקון:** תוקף התקרה - מקור אחד אומר "עד 15.1.2028" ולא "סוף 2027".
> להשתמש ב-`validThrough: "ינואר 2028"` ולסמן לבדיקה חוזרת.
>
> **דרך לסגור את זה:** להתקין ספריית PDF ולחלץ את הוראת ביצוע 2/2024, או
> שבעל המוצר יפתח את ה-PDF ויקריא את המספרים. שתיהן מהירות.


> ## אזהרת איכות מקורות - ה-PM, 2026-09-21
>
> **המשימה דרשה מקורות רשמיים בלבד (`taxes.gov.il`, נוסח החוק). היא לא קוימה במלואה.**
>
> מה שצוטט בפועל:
>
> | מקור | סוג | משקל |
> |---|---|---|
> | `nevo.co.il` - נוסח חוק מיסוי מקרקעין | נוסח החוק | **אמין** |
> | `kolzchut.org.il` | מאגר זכויות ציבורי | סביר כמשני |
> | `yasmint-law.com`, `hmercaz.com`, `gatax.co.il` | **אתרי שיווק של משרדי עו"ד ורו"ח** | **לא מקור** |
>
> **רשות המסים עצמה לא צוטטה כמקור לאף מספר.**
>
> לכן: **אף מספר במסמך הזה אינו `verified`.** מותר להשתמש בו כדי לתכנן את מבנה
> הקוד ואת ממשק המשתמש. **אסור להציג מספר מכאן למשתמש קצה** לפני אימות מול
> רשות המסים או יועץ מס. זה נתון שאנשים מקבלים לפיו החלטות על מאות אלפי שקלים.
>
> ### תיקון מהותי, 2026-09-21
>
> המסמך נכתב מתוך הנחה שקהל היעד הוא **דירה שנייה**. **בעל המוצר תיקן: ברירת
> המחדל היא דירה ראשונה.** לכן המסקנה מתהפכת - פטור סעיף 49ב(2) וכלל 18 החודשים
> מיום האכלוס הם **המסלול המרכזי**, לא תרחיש שולי. המסלול של 25% ללא פטור הוא
> מה שקורה כשהמשתמש מסמן שזו אינה דירתו הראשונה.
>
> **מה שכן ניתן להסתמך עליו** הוא המסקנה המבנית, שנשענת על נוסח החוק ב-nevo:
> הפטור של סעיף 49ב(2) חל על **מוכר דירה יחידה בלבד**. קהל היעד של הכלי - משקיע
> בדירה שנייה - **אינו זכאי לו**. זה משנה את הפיצ'ר, לא רק את המספרים.


> asOf: 2026-09 | verified by: api-scout

---

## Is the 18-month rule correct?

Product owner stated: exemption from profit only if more than 18 months passed since occupancy.

Answer: THE RULE EXISTS BUT IS NOT RELEVANT TO THE TOOL TARGET AUDIENCE.
Section 49b(2) of the Real Estate Taxation Law grants full capital gains tax exemption
to sellers of a SINGLE apartment (dirat yechida only), provided:
- 18 months passed since the apartment became a residence (tofes 4 for off-plan; contract date for ready),
- the seller has not used this exemption in the previous 18 months,
- sale price does not exceed 5,008,000 ILS.

An investor buying a SECOND apartment has NO exemption, regardless of holding period.
They pay 25% on real capital gains from 1.1.2014 onwards (linear calculation, section 48a(b1)).

What is accurate: the 18-month clock starts from tofes 4 (not contract). Correct for off-plan.

What is misleading: the rule does not apply to second-apartment investors.
Tool default: no exemption, 25% linear tax.

---

## Rules table

| rule | detail | section | source | asOf | verified |
|---|---|---|---|---|---|
| single-apt exemption holding | min 18 months from day apt became residence | 49b(2) | nevo.co.il, kolzchut.org.il | 2025 | yes |
| 18-month count off-plan | from occupancy permit (tofes 4) NOT contract | 49b(2) | kolzchut.org.il | 2025 | yes |
| 18-month count ready apt | from contract signing date | 49b(2) | kolzchut.org.il | 2025 | yes |
| single-apt price ceiling | 5,008,000 ILS | 49b(2) | kolzchut.org.il | 2024-2027 | yes |
| frequency limit | cannot reuse exemption within 18 months | 49b(2) | kolzchut.org.il | 2025 | yes |
| second apt - exemption | NO exemption, always taxable | 48a(b) | all sources | 2026 | yes |
| capital gains tax rate | 25% on real gain | 48a(b) | nevo.co.il | 2026 | yes |
| linear cutoff date | gains before 1.1.2014 = exempt; from 1.1.2014 = 25% | 48a(b1) | yasmint-law.com | 2026 | yes |
| purchase date for tax | contract signing date (not land registry not occupancy) | 19 | kolzchut.org.il | 2026 | yes |
| deductible: purchase tax | full deduction | 39 | hmercaz.com | 2026 | yes |
| deductible: legal fees | purchase and sale | 39 | hmercaz.com | 2026 | yes |
| deductible: agent fees | purchase and sale | 39 | hmercaz.com | 2026 | yes |
| deductible: renovation | with receipts | 39 | hmercaz.com | 2026 | yes |
| deductible: real mortgage interest | real interest only, conditions unclear | 39 | hmercaz.com | 2026 | NOT VERIFIED |
| rights assignment (flip before occupancy) | not researched | - | - | - | NO |

---

## Formula - pseudocode (translates to TypeScript)

### Regulatory constants (in data file with asOf + source)

```
TAX_RATE = 0.25                    // section 48a(b), verified 2026
LINEAR_CUTOFF_DATE = 2014-01-01    // reform date, verified 2026
SINGLE_APT_CEILING = 5_008_000     // ILS, section 49b(2), valid 2024-2027
SINGLE_APT_MIN_MONTHS = 18         // section 49b(2), verified 2025
```

### Investment apartment calculation (default - no exemption)

```
inputs:
  purchasePrice, salePrice
  purchaseDate    // contract signing date, section 19
  saleDate        // contract signing date
  purchaseTax, legalFeesBuy, legalFeesSell
  agentFeesBuy, agentFeesSell
  renovationCosts, otherDeductible

step 1:  grossGain = salePrice - purchasePrice

step 2:  deductibleExpenses = purchaseTax + legalFeesBuy + legalFeesSell
                            + agentFeesBuy + agentFeesSell + renovationCosts + otherDeductible

step 3:  netGain = grossGain - deductibleExpenses
         if netGain <= 0: taxAmount = 0, done.

step 4: linear split (section 48a(b1))
  totalHoldingDays = saleDate - purchaseDate (in days)
  if purchaseDate >= 2014-01-01:
    daysBeforeCutoff = 0  // all taxable
  else:
    daysBeforeCutoff = days(purchaseDate to 2014-01-01)
  daysAfterCutoff = totalHoldingDays - daysBeforeCutoff
  ratioExempt  = daysBeforeCutoff / totalHoldingDays
  ratioTaxable = 1 - ratioExempt

step 5:
  exemptPortion  = netGain * ratioExempt
  taxablePortion = netGain * ratioTaxable
  taxAmount      = taxablePortion * 0.25
  effectiveRate  = taxAmount / netGain

// layer-2 breakdown fields:
// grossGain, deductibleExpenses, netGain,
// exemptPortion, taxablePortion, taxAmount, effectiveRate,
// totalHoldingDays, daysBeforeCutoff, daysAfterCutoff, ratioExempt, ratioTaxable
```

### Single-apartment exemption check (comparison scenario only)

```
startDate = occupancyDate ?? purchaseDate
  // occupancyDate = tofes 4 for off-plan; null for ready apartment
holdingMonths = (saleDate - startDate) / 30.44
eligible = isSingleApartment AND holdingMonths >= 18 AND salePrice <= 5_008_000
// for this tool: isSingleApartment = false (investment = 2nd apartment)
```

---

## Not verified

| topic | why | action before launch |
|---|---|---|
| real mortgage interest deductible | sources say under certain conditions without detail | verify at taxes.gov.il |
| mandatory depreciation for rented apt | may reduce cost basis even if not claimed | verify if rental scenario included |
| rights assignment before occupancy | not researched | must verify if tool supports pre-delivery resale |
| inflationary component pre-1994 assets | 10% rate not verified from law text | only if supporting pre-1994 assets |
| 5,008,000 ceiling update mechanism | unknown if/when it updates | mark asOf in data file; check yearly |

---

## Sources

- [kolzchut.org.il - single apartment exemption](https://www.kolzchut.org.il/he/%D7%A4%D7%98%D7%95%D7%A8_%D7%9E%D7%9E%D7%A1_%D7%A9%D7%91%D7%97_%D7%91%D7%9E%D7%9B%D7%99%D7%A8%D7%AA_%D7%93%D7%99%D7%A8%D7%94_%D7%99%D7%97%D7%99%D7%93%D7%94)
- [nevo.co.il - Real Estate Taxation Law 1963](https://www.nevo.co.il/law_html/law01/276_002.htm)
- [yasmint-law.com - linear calculation](https://yasmint-law.com/appreciation-tax/%D7%9B%D7%9E%D7%94-%D7%9E%D7%A1-%D7%A9%D7%91%D7%97-%D7%90%D7%A9%D7%9C%D7%9D-%D7%91%D7%9E%D7%9B%D7%99%D7%A8%D7%AA-%D7%93%D7%99%D7%A8%D7%94-%D7%A9%D7%A0%D7%99%D7%94-%D7%90%D7%95-%D7%99%D7%95%D7%AA%D7%A8/)
- [hmercaz.com - capital gains calculation](https://hmercaz.com/%D7%90%D7%99%D7%9A-%D7%9E%D7%97%D7%A9%D7%91%D7%99%D7%9D-%D7%9E%D7%A1-%D7%A9%D7%91%D7%97/)
- [gatax.co.il - linear calculation](https://www.gatax.co.il/%D7%97%D7%99%D7%A9%D7%95%D7%91-%D7%9E%D7%A1-%D7%A9%D7%91%D7%97-%D7%9C%D7%99%D7%A0%D7%90%D7%A8%D7%99/)
