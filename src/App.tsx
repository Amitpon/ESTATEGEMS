import { Route, Switch } from 'wouter'
import { AnalyzePage } from '@/pages/AnalyzePage'

/**
 * שכבת הניתוב. היום יש מסלול יחיד - ניתוח נכס בודד.
 *
 * למה בכל זאת router ולא רק `<AnalyzePage />`: שלב ב בתוכנית (Appwrite,
 * auth, שמירת נכסים והשוואה) דורש מסכי `/login` ו-`/properties` שיושבים
 * כאן. בונים את השלד עכשיו כדי שמסך ההתחברות לא ידרוש רה-ארגון נוסף.
 *
 * `Route` לא-תואם נופל חזרה ל-`AnalyzePage` - אין עדיין מסך 404 ייעודי,
 * וזה עדיף על מסך ריק.
 */
export default function App() {
  return (
    <Switch>
      <Route path="/" component={AnalyzePage} />
      <Route component={AnalyzePage} />
    </Switch>
  )
}
