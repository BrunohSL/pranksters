import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '../../lib/supabase';

interface Photo {
  id: string;
  image_path: string;
  caption: string | null;
  event_date: string | null;
}

export default function Gallery() {
  const [rows, setRows] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) {
      setError('Site ainda sem conexão com o banco (configure as chaves do Supabase).');
      setLoading(false);
      return;
    }

    supabase
      .from('gallery_photos')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setRows((data as Photo[]) ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-white/50">Carregando fotos...</p>;
  if (error) return <p className="text-red-400">{error}</p>;
  if (rows.length === 0) return <p className="text-white/50">Nenhuma foto publicada ainda.</p>;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {rows.map((photo) => {
        const { data } = supabase.storage.from('gallery').getPublicUrl(photo.image_path);
        return (
          <figure
            key={photo.id}
            className="group overflow-hidden rounded-lg border border-prank-border bg-prank-surface"
          >
            <img
              src={data.publicUrl}
              alt={photo.caption ?? 'Foto da Pranksters'}
              loading="lazy"
              className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
            />
            {photo.caption && (
              <figcaption className="px-2 py-2 text-xs text-white/60">{photo.caption}</figcaption>
            )}
          </figure>
        );
      })}
    </div>
  );
}
