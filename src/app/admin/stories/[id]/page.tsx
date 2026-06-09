import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getStoryById } from '@/lib/repositories';
import { buildMetadata } from '@/lib/seo';
import { STORY_TAGS } from '@/lib/constants';
import { publishStoryAction, rejectStoryAction } from '@/app/actions';
import styles from '../../admin.module.css';
import detailStyles from './story-detail.module.css';

export const metadata = buildMetadata({ title: 'История — модерация' });

export default async function AdminStoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const story = await getStoryById(id);
  if (!story) notFound();

  const isPublished = story.status === 'published';
  const isRejected = story.status === 'rejected';

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/admin/stories" className="btn btn-sm btn-ghost">
            ← Назад
          </Link>
          <h1 className={styles.pageTitle}>
            <span className={styles.pageTitleAccent} aria-hidden="true" />
            История путешествия
          </h1>
        </div>
      </div>

      {/* Notices */}
      {sp.status === 'published' && (
        <div className={`${styles.notice} ${styles.noticeSuccess}`}>
          История опубликована и отображается на сайте.
        </div>
      )}
      {sp.status === 'rejected' && (
        <div className={`${styles.notice} ${styles.noticeError}`}>
          История отклонена.
        </div>
      )}
      {sp.status === 'invalid' && (
        <div className={`${styles.notice} ${styles.noticeError}`}>
          Заполните все обязательные поля перед публикацией.
        </div>
      )}

      <div className={styles.formLayout}>
        {/* Left column — raw data */}
        <div className={detailStyles.rawPanel}>
          <div className={styles.formPanel}>
            <h2 className={styles.formPanelTitle}>Данные от клиента</h2>
            <dl className={detailStyles.dl}>
              <div className={detailStyles.dlRow}>
                <dt>Автор</dt>
                <dd>{story.rawAuthorName}</dd>
              </div>
              <div className={detailStyles.dlRow}>
                <dt>Объект</dt>
                <dd>{story.rawObject}</dd>
              </div>
              <div className={detailStyles.dlRow}>
                <dt>Период</dt>
                <dd>{story.rawPeriod || '—'}</dd>
              </div>
              <div className={detailStyles.dlRow}>
                <dt>Менеджер</dt>
                <dd>{story.rawManager || '—'}</dd>
              </div>
              <div className={detailStyles.dlRow}>
                <dt>Дата подачи</dt>
                <dd>{new Date(story.submittedAt).toLocaleString('ru-RU')}</dd>
              </div>
              {isPublished && story.publishedAt && (
                <div className={detailStyles.dlRow}>
                  <dt>Опубликована</dt>
                  <dd>{new Date(story.publishedAt).toLocaleString('ru-RU')}</dd>
                </div>
              )}
              {isRejected && story.rejectedAt && (
                <div className={detailStyles.dlRow}>
                  <dt>Отклонена</dt>
                  <dd>{new Date(story.rejectedAt).toLocaleString('ru-RU')}</dd>
                </div>
              )}
              {isRejected && story.rejectionReason && (
                <div className={detailStyles.dlRow}>
                  <dt>Причина</dt>
                  <dd className={detailStyles.ddRed}>{story.rejectionReason}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className={styles.formPanel}>
            <h2 className={styles.formPanelTitle}>Текст истории</h2>
            <p className={detailStyles.rawText}>{story.rawText}</p>
          </div>

          {story.photos.length > 0 && (
            <div className={styles.formPanel}>
              <h2 className={styles.formPanelTitle}>Фотографии</h2>
              <div className={detailStyles.photos}>
                {story.photos.map((src, i) => (
                  <a key={i} href={src} target="_blank" rel="noopener noreferrer" className={detailStyles.photoLink}>
                    <Image
                      src={src}
                      alt={`Фото ${i + 1}`}
                      width={160}
                      height={120}
                      style={{ objectFit: 'cover', borderRadius: 8 }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — moderation */}
        <div>
          {!isPublished && !isRejected ? (
            <>
              {/* Publish form */}
              <div className={styles.formPanel}>
                <h2 className={styles.formPanelTitle}>Публикация</h2>
                <form action={publishStoryAction} className={detailStyles.moderForm}>
                  <input type="hidden" name="storyId" value={story.id} />

                  <div className="field">
                    <label htmlFor="pubTitle" className={detailStyles.label}>
                      Заголовок для карточки *
                    </label>
                    <input
                      id="pubTitle"
                      name="pubTitle"
                      className="input"
                      placeholder="Короткий броский заголовок"
                      defaultValue={story.pubTitle ?? ''}
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="pubQuote" className={detailStyles.label}>
                      Цитата для карточки * <span className={detailStyles.hint}>(до 200 символов)</span>
                    </label>
                    <textarea
                      id="pubQuote"
                      name="pubQuote"
                      className="textarea"
                      rows={3}
                      maxLength={200}
                      placeholder="Выжимка из истории клиента…"
                      defaultValue={story.pubQuote ?? ''}
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="pubTag" className={detailStyles.label}>
                      Тег категории *
                    </label>
                    <select
                      id="pubTag"
                      name="pubTag"
                      className="select"
                      defaultValue={story.pubTag ?? ''}
                      required
                    >
                      <option value="">Выберите тег…</option>
                      {STORY_TAGS.filter((t) => t !== 'Все').map((tag) => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="pubObjectUrl" className={detailStyles.label}>
                      Ссылка на объект <span className={detailStyles.hint}>(необязательно)</span>
                    </label>
                    <input
                      id="pubObjectUrl"
                      name="pubObjectUrl"
                      className="input"
                      placeholder="/objects/chaika-anapa"
                      defaultValue={story.pubObjectUrl ?? ''}
                    />
                  </div>

                  <button type="submit" className="btn btn-red">
                    Опубликовать →
                  </button>
                </form>
              </div>

              {/* Reject form */}
              <div className={styles.formPanel}>
                <h2 className={styles.formPanelTitle}>Отклонить</h2>
                <form action={rejectStoryAction} className={detailStyles.moderForm}>
                  <input type="hidden" name="storyId" value={story.id} />
                  <div className="field">
                    <label htmlFor="reason" className={detailStyles.label}>
                      Причина <span className={detailStyles.hint}>(внутренний лог, клиенту не отправляется)</span>
                    </label>
                    <textarea
                      id="reason"
                      name="reason"
                      className="textarea"
                      rows={3}
                      placeholder="Не соответствует стандартам публикации…"
                    />
                  </div>
                  <button type="submit" className="btn btn-ghost">
                    Отклонить
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className={styles.formPanel}>
              <h2 className={styles.formPanelTitle}>Карточка на сайте</h2>
              {isPublished ? (
                <dl className={detailStyles.dl}>
                  <div className={detailStyles.dlRow}>
                    <dt>Заголовок</dt>
                    <dd>{story.pubTitle}</dd>
                  </div>
                  <div className={detailStyles.dlRow}>
                    <dt>Цитата</dt>
                    <dd>{story.pubQuote}</dd>
                  </div>
                  <div className={detailStyles.dlRow}>
                    <dt>Тег</dt>
                    <dd>{story.pubTag}</dd>
                  </div>
                  {story.pubObjectUrl && (
                    <div className={detailStyles.dlRow}>
                      <dt>Ссылка</dt>
                      <dd>{story.pubObjectUrl}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className={detailStyles.hint}>История отклонена и не отображается на сайте.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
