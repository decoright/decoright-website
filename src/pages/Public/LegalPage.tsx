import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LegalService } from '@/services/legal.service';
import type { LegalPage as LegalPageType } from '@/services/legal.service';
import Spinner from '@/components/common/Spinner';
import { getUserFriendlyError } from '@/utils/error-messages';

export function LegalPage() {
  const { slug } = useParams<{ slug: string }>();
  const { i18n, t } = useTranslation();
  const [page, setPage] = useState<LegalPageType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPage() {
      if (!slug) return;
      try {
        setLoading(true);
        setError(null);
        const data = await LegalService.getPageBySlug(slug);
        if (data) {
          setPage(data);
        } else {
          setError(t('errors.not_found'));
        }
      } catch (err: any) {
        setError(getUserFriendlyError(err, t));
      } finally {
        setLoading(false);
      }
    }

    loadPage();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <h1 className="text-2xl font-bold mb-4">{error || 'Page not found'}</h1>
      </div>
    );
  }

  // Get current language content
  const lang = i18n.language as 'en' | 'ar' | 'fr';
  const title = page[`title_${lang}` as keyof LegalPageType] as string || page.title_en;
  const content = page[`content_${lang}` as keyof LegalPageType] as string || page.content_en;
  const isArabic = lang === 'ar';

  return (
    <main>
      <section className="min-h-[50vh] content-container relative w-full px-4 sm:px-8 md:px-12 pt-12 mt-20">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 text-foreground">{title}</h1>
        <div className={`max-w-none text-muted-foreground ${isArabic ? 'text-right' : ''}`} dir={isArabic ? 'rtl' : 'ltr'}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h1 className="text-3xl md:text-4xl font-bold text-foreground mt-10 mb-4">{children}</h1>,
              h2: ({ children }) => <h2 className="text-2xl md:text-3xl font-semibold text-foreground mt-8 mb-3">{children}</h2>,
              h3: ({ children }) => <h3 className="text-xl md:text-2xl font-semibold text-foreground mt-6 mb-3">{children}</h3>,
              h4: ({ children }) => <h4 className="text-lg md:text-xl font-semibold text-foreground mt-5 mb-2">{children}</h4>,
              p: ({ children }) => <p className="text-sm md:text-base leading-7 mb-4 text-muted-foreground">{children}</p>,
              ul: ({ children }) => <ul className="list-disc list-inside space-y-2 mb-4">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside space-y-2 mb-4">{children}</ol>,
              li: ({ children }) => <li className="text-sm md:text-base leading-7 text-muted-foreground">{children}</li>,
              blockquote: ({ children }) => <blockquote className="border-s-4 border-primary/40 ps-4 italic my-5 text-muted-foreground/90">{children}</blockquote>,
              a: ({ href, children }) => (
                <a href={href} className="text-primary underline underline-offset-4 hover:text-primary/80" target="_blank" rel="noreferrer noopener">
                  {children}
                </a>
              ),
              hr: () => <hr className="my-8 border-muted/20" />,
              code: ({ children }) => <code className="bg-emphasis px-1.5 py-0.5 rounded text-sm text-foreground">{children}</code>,
              pre: ({ children }) => <pre className="bg-emphasis border border-muted/15 rounded-lg p-4 overflow-x-auto my-4">{children}</pre>,
              table: ({ children }) => <div className="overflow-x-auto my-5"><table className="w-full border-collapse">{children}</table></div>,
              th: ({ children }) => <th className="text-left font-semibold text-foreground border border-muted/20 px-3 py-2 bg-emphasis">{children}</th>,
              td: ({ children }) => <td className="border border-muted/20 px-3 py-2 text-muted-foreground">{children}</td>,
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </section>
    </main>
  );
}

export default LegalPage;
