export default function Spinner({ className = 'py-16' }: { className?: string }) {
  return (
    <div className={`flex justify-center ${className}`} role="status" aria-label="Cargando">
      <span className="w-7 h-7 rounded-full border-[3px] border-brand/30 border-t-brand animate-spin" />
    </div>
  )
}
