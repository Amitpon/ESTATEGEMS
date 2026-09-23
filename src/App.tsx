import { Route, Switch } from 'wouter'
import { AnalyzePage } from '@/pages/AnalyzePage'
import { PropertiesPage } from '@/pages/PropertiesPage'
import { usePropertyAnalysis } from '@/hooks/usePropertyAnalysis'

/**
 * שכבת הניתוב. `usePropertyAnalysis` יושב כאן, לא ב-`AnalyzePage`, כי
 * `/properties` צריך גישה לאותו state - "פתח לעריכה" בטעינת נכס שמור
 * מזין את הטופס וחוזר ל-`/`, ואי אפשר לזה לעבוד עם שני hooks נפרדים.
 *
 * `Route` לא-תואם נופל חזרה ל-`AnalyzePage` - אין עדיין מסך 404 ייעודי,
 * וזה עדיף על מסך ריק.
 */
export default function App() {
  const analysis = usePropertyAnalysis()

  return (
    <Switch>
      <Route path="/properties" component={() => <PropertiesPage analysis={analysis} />} />
      <Route path="/" component={() => <AnalyzePage analysis={analysis} />} />
      <Route component={() => <AnalyzePage analysis={analysis} />} />
    </Switch>
  )
}
