import { useTranslation } from 'react-i18next';
import { Card, CardBody } from '@/components/ui/Card';

// Single Operator Mode: this page (and its copy) must not surface tenancy
// concepts (workspace/company/user/team/membership) — those stay internal
// to the architecture until multi-user is reactivated (see CLAUDE.md).
export function Settings() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('nav.settings')}</h1>
      <Card>
        <CardBody className="space-y-2 text-sm">
          <p className="text-[var(--text-primary)]">{t('app.name')}</p>
          <p className="text-[var(--text-muted)]">{t('settings.description')}</p>
        </CardBody>
      </Card>
    </div>
  );
}
