import { buildMetadata } from '@/lib/seo';
import { listTags } from '@/lib/repositories';
import styles from '../admin.module.css';
import tagStyles from './story-tags.module.css';
import { TagsManager } from './tags-manager';

export const metadata = buildMetadata({ title: 'Теги историй' });

export default async function StoryTagsPage() {
  const tags = await listTags();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>
          <span className={styles.pageTitleAccent} aria-hidden="true" />
          Теги историй путешествий
        </h1>
      </div>

      <div className={tagStyles.hint}>
        Переименуйте тег — название обновится везде автоматически.
        Добавлять и удалять теги может только команда разработки.
      </div>

      <TagsManager initialTags={tags} />
    </div>
  );
}
