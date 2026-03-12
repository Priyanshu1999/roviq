'use client';

import { gql, useMutation, useQuery } from '@roviq/graphql';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@roviq/ui';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

interface NotificationConfig {
  id: string;
  notificationType: string;
  inAppEnabled: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  digestEnabled: boolean;
  digestCron?: string | null;
}

interface NotificationConfigsData {
  notificationConfigs: NotificationConfig[];
}

interface UpdateNotificationConfigData {
  updateNotificationConfig: NotificationConfig;
}

interface UpdateNotificationConfigVariables {
  input: {
    notificationType: string;
    inAppEnabled?: boolean;
    whatsappEnabled?: boolean;
    emailEnabled?: boolean;
    pushEnabled?: boolean;
    digestEnabled?: boolean;
    digestCron?: string;
  };
}

const NOTIFICATION_CONFIGS_QUERY = gql`
  query NotificationConfigs {
    notificationConfigs {
      id
      notificationType
      inAppEnabled
      whatsappEnabled
      emailEnabled
      pushEnabled
      digestEnabled
      digestCron
    }
  }
`;

const UPDATE_NOTIFICATION_CONFIG_MUTATION = gql`
  mutation UpdateNotificationConfig($input: UpdateNotificationConfigInput!) {
    updateNotificationConfig(input: $input) {
      id
      notificationType
      inAppEnabled
      whatsappEnabled
      emailEnabled
      pushEnabled
      digestEnabled
      digestCron
    }
  }
`;

const NOTIFICATION_TYPES = ['FEE', 'ATTENDANCE', 'APPROVAL'] as const;
type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const NOTIFICATION_TYPE_KEY: Record<NotificationType, 'fee' | 'attendance' | 'approval'> = {
  FEE: 'fee',
  ATTENDANCE: 'attendance',
  APPROVAL: 'approval',
};

type ChannelField =
  | 'inAppEnabled'
  | 'whatsappEnabled'
  | 'emailEnabled'
  | 'pushEnabled'
  | 'digestEnabled';

type ChannelLabelKey = 'inApp' | 'whatsapp' | 'email' | 'push' | 'digest';

const CHANNELS: Array<{ field: ChannelField; labelKey: ChannelLabelKey }> = [
  { field: 'inAppEnabled', labelKey: 'inApp' },
  { field: 'whatsappEnabled', labelKey: 'whatsapp' },
  { field: 'emailEnabled', labelKey: 'email' },
  { field: 'pushEnabled', labelKey: 'push' },
  { field: 'digestEnabled', labelKey: 'digest' },
];

function getDefaultConfig(notificationType: string): NotificationConfig {
  return {
    id: '',
    notificationType,
    inAppEnabled: false,
    whatsappEnabled: false,
    emailEnabled: false,
    pushEnabled: false,
    digestEnabled: false,
    digestCron: null,
  };
}

export default function NotificationPreferencesPage() {
  const t = useTranslations('notifications');

  const { data, loading } = useQuery<NotificationConfigsData>(NOTIFICATION_CONFIGS_QUERY);

  const [updateConfig] = useMutation<
    UpdateNotificationConfigData,
    UpdateNotificationConfigVariables
  >(UPDATE_NOTIFICATION_CONFIG_MUTATION, {
    refetchQueries: [{ query: NOTIFICATION_CONFIGS_QUERY }],
    onCompleted: () => {
      toast.success(t('saved'));
    },
  });

  function getConfig(notificationType: string): NotificationConfig {
    return (
      data?.notificationConfigs.find((c) => c.notificationType === notificationType) ??
      getDefaultConfig(notificationType)
    );
  }

  function handleToggle(notificationType: string, field: ChannelField, value: boolean) {
    const current = getConfig(notificationType);
    updateConfig({
      variables: {
        input: {
          notificationType,
          inAppEnabled: field === 'inAppEnabled' ? value : current.inAppEnabled,
          whatsappEnabled: field === 'whatsappEnabled' ? value : current.whatsappEnabled,
          emailEnabled: field === 'emailEnabled' ? value : current.emailEnabled,
          pushEnabled: field === 'pushEnabled' ? value : current.pushEnabled,
          digestEnabled: field === 'digestEnabled' ? value : current.digestEnabled,
        },
      },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('notificationType')}</TableHead>
                {CHANNELS.map((ch) => (
                  <TableHead key={ch.field} className="text-center">
                    {t(ch.labelKey)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {NOTIFICATION_TYPES.map((type) => {
                const config = getConfig(type);
                const labelKey = NOTIFICATION_TYPE_KEY[type];
                return (
                  <TableRow key={type}>
                    <TableCell className="font-medium">{t(labelKey)}</TableCell>
                    {CHANNELS.map((ch) => (
                      <TableCell key={ch.field} className="text-center">
                        <Switch
                          checked={config[ch.field]}
                          onCheckedChange={(val) => handleToggle(type, ch.field, val)}
                          disabled={loading}
                          aria-label={`${t(labelKey)} ${t(ch.labelKey)}`}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
