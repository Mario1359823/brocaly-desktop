import React from 'react';

export const BrocalyBrand = ({ className }: { className?: string }) => (
    <span className={`font-sans font-extrabold text-brand-navy tracking-widest ${className ?? ''}`}>
        BROCA<span className="text-brand-orange">LY</span>
    </span>
);

export const BrocalyTextLogo = ({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) => {
    const sizeClass = { sm: 'text-lg', md: 'text-[21px]', lg: 'text-2xl', xl: 'text-5xl' }[size];
    return (
        <span className={`${sizeClass} font-sans font-extrabold text-brand-navy tracking-widest ${className ?? ''}`}>
            BROCA<span className="text-brand-orange">LY</span>
        </span>
    );
};

export const BrocalyLogo = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" fill="none" viewBox="0 0 200 200" className={className}>
        <path d="m17.18 167.2 3.76-0.97c2.87 0 5.52 0.24 8.7 0.88 2.97 0.63 3.99 3.09 3.99 5.15 0 2.31-0.92 3.75-2.93 4.53 2.55 1.12 3.99 2.98 3.99 5.44 0 4.7-4.18 7.58-12.48 7.58-1.8 0-3.9-0.19-5.49-0.48l0.46-22.13zm2.41 9.11c5.82-0.34 11.3-1.21 11.54-4.75 0.15-2.32-1.91-3.14-7.24-3.29-2.71-0.09-3.68 0.25-3.87 1.79-0.24 1.75-0.43 3.96-0.43 6.25zm-0.15 11.15c8.49-0.1 12.27-2.5 12.27-5.8 0-2.55-2.01-3.57-4.99-3.38-2.21 0.15-4.71 0.49-7.07 0.68l-0.21 8.5z" fill="#1A6D59" />
        <path d="m40.91 167.2 5.28-0.78c4.95 0.44 7.46 3.98 7.46 7.26 0 3.64-1.87 5.75-5.1 6.97l4.32 7.43c0.44 0.77-0.19 1.79-1.11 1.55l-5.57-7.57c-0.78-0.78-1.95-1.07-3.27-1.07l-0.2 8.4c-0.04 0.68-2 0.68-2.05 0l0.24-22.19zm1.91 11.28c5.53-0.29 8.4-1.78 8.4-5.22 0-2.93-2.3-4.68-6.1-4.68-1.17 0-2.3 0.29-2.35 1.07l0.05 8.83z" fill="#1A6D59" />
        <path d="m71.66 167.1h1.12c6.21 0 10.63 4.41 10.63 11.37 0 6.3-4.42 11.29-10.63 11.29-6.67 0-12.77-3.79-12.77-10.05 0-5.48 5.96-12.61 11.65-12.61zm-8.78 12.08c0 5.09 5.43 8.07 9.9 8.07 4.71 0 7.99-4.42 7.99-9.46 0-5.19-3.85-8.37-8.84-8.37-4.28-0.01-9.05 5.86-9.05 9.76z" fill="#1A6D59" />
        <path d="m107.3 169.1c-0.19 1.22-0.92 1.61-2.31 1.27-1.27-0.34-2.6-0.49-3.93-0.49-6.01 0-9.4 4.7-9.4 8.41 0 5.43 4.03 9.46 8.59 9.46 2.16 0 4.01-0.58 6.03-1.6 1.17-0.34 2.04 0.78 1.41 1.9-2.11 1.27-4.51 1.95-7.34 1.95-6.97 0-10.96-6.01-10.96-12.02 0-4.94 5.73-10.67 11.5-10.67 2.79 0 5.24 0.29 6.41 1.31v0.48z" fill="#1A6D59" />
        <path d="m122.9 166.8h0.87c0.63 0 1.65 2.41 3.29 6.53l6.96 14.5v0.87c0 0.82-0.63 1.06-1.5 0.92l-3.33-8.01h-9.79l-2.93 7.72c-0.87 0.97-2.31 0.39-2.07-0.93l8.5-21.6zm-2.55 12.16h7.76l-4.22-9.15-3.54 9.15z" fill="#1A6D59" />
        <path d="m141.1 168.2h1.8c0.63 0.73 0.73 5.72 0.63 19.19l11.39-0.68c1.49-0.1 1.68 2.31 0.51 2.46l-12.53 0.63c-1.38 0.1-1.86-0.29-1.86-1.83-0.14-9.94-0.19-17.98 0.06-19.77z" fill="#FC7016" />
        <path d="m163.8 165c0.87-0.29 1.84 0.83 4.3 4.22l5.33 7.07 8.21-11.29c1.07-0.97 2.87 0.05 2.43 1.32l-9.55 12.58-0.54 10.81c-0.24 0.92-1.67 0.73-1.77-0.19l-0.1-10.91-8.4-11.61c-0.63-0.83-0.53-1.7 0.09-2z" fill="#FC7016" />
        <path d="m45.18 85.06c2.74-3.85 7.83-10.15 15.94-10.54 6.82-0.34 12.83-0.1 14.53 1.6 1.59-2.11 3.29-4.41 10.45-4.41 1.59 0 3.44 0.1 4.02-1.18 1.33-2.88 8-4.88 12.61-4.88 2.98 0 4.46 2.36 6 5.07 2.98-2.97 6.41-4.67 12.42-4.38 6.31 0.29 9.59 4.19 12.67 8.57 1.07 0.87 2.19-0.5 4.4-0.4 1.43 0.05 1.87 1.02 3.93 1.02 1.75 0 6.26-1.32 10.78-1.02 4.85 0.3 6.13 1.89 11.12 4.92 4.85 2.93 6.44 6.62 6.44 10.21 0 1.8 4.13 1.99 5.56 2.38 2.98 0.82 7.88 2.88 9.37 4.99 2.21 3.28 3.28 7.08 2.99 11.25-0.34 5.18-1.98 6.67-1.59 8.68 0.39 1.9 2.84 3.81 5.2 5.45 3.99 2.73 6.59 10.73 6.59 15.24 0 4.27-1.38 9.07-3.49 9.99-1.17 0.53 0.48 1.06 0 1.84-2.41 4.12-4.31 6.68-12.07 6.29-2.98-0.15-3.27-0.93-3.8-0.93-2.11 0-8.12 1.8-14.13 1.8-4.71 0-6.46-0.97-7.89-2.4-1.12-1.12-3.33-0.78-5.69 0.71-2.06 1.22-3.49 1.41-7.72 1.22-7.76-0.34-11.19-1.07-17.7-3.13-2.01 0-2.88 1.91-6.91 1.81-4.13-0.1-7.41-2.1-8.79-4.61-3.13 2.93-4.4 3.9-9.73 3.51-5.28-0.39-12.44-0.34-15.67-1.21-4.42-1.23-11.93-5.22-12.9-5.51 0.68 0.87 1.31 1.3 0.68 2.08-2.31 2.83-5.89 3.51-11.67 3.51-6.96 0-9.02-0.97-12.71-2.35-1.7-0.68-3.08-0.44-3.71 0.79-0.53 0.97-5.43 0.49-6.3-1.97-0.63-1.85-1.8 0.84-3.8 2.22-1.9 1.33-5.18 2.15-8.87 0-2.83-1.54-4.89-2.98-6.01-2.98s-2.81 1.38-8.44 1.14c-6.36-0.29-7.58-2.65-9.54-8.13-0.82-1.9-0.63-2.19-0.34-5.17s1.31-4.05 2.64-5.12c-0.34-3.85 2.02-8.74 4.9-12.12 0.68-0.82-0.15-2.88-1.07-4.42-1.43-2.66-1.67-9.37 1.76-13.59 3.64-4.42 7.43-6.12 11.18-5.98 2.26 0.1 5.09 0.83 5.91 0.54 1.17-0.44 0.15-6.35 4.42-8.1 4.46-1.8 9.02-1.17 11.57-0.35 1.39 0.49 1.63-0.82 2.46-1.95z" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m144.9 76.74c1.32 1.96 1.85 6.28 0.84 9.46" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m170.1 90.61c0.68 2.66-0.29 7.6-1.16 9.3-1.64 3.38-3.6 5.54-6.29 8.42" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m170.1 100.8c3.13-0.82 7.74 0.67 7.3 7.89-0.15 1.9-0.39 3.18-0.78 3.67" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m185.9 115.7c-0.82 3.49-3.6 7.44-6.58 11.03" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m149.1 122.7c4.13-4.27 5.93-9.5 5.44-16.67-0.58-6.96-2.48-10.95-5.81-12.75-5.63-2.98-12.94-6.31-17.79-4.72-1.96 0.68-1.81 0.97-2.39 0.68-0.44-5.18-2.79-9.6-8.13-10.62-2.35-0.44-2.69-2.89-1.77-6.38 0.24-0.92-1.46-0.92-1.46-0.39" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m137.9 137c1.95-1.32 10.3-2.76 10.79 2.77 0.19 2.01-0.1 1.81-0.59 2.01-1.02-1.59-1.84-4.67-4.3-4.77-3.38-0.19-4.2 0.68-6 3.66-1.02 1.8-2.77 2.77-3.11 2.67" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m118.6 147.9c0.39 1.54 1.98 2.71 4.34 3.39" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m170.9 154.1c2.69-0.92 5.15-4.1 8.69-7.79 0.58-0.58 0.73-0.19 0.19 1.19-0.97 2.55-2.67 4.71-3.2 5.73" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m191.6 148.3c1.07 0.15 2.45-0.58 3.47-1.45" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m137.6 113.7c2.11-1.59 2.69-10.09-1.73-12.7-2.98-1.69-9.99 0.47-13.12 1.79" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m136.7 114c4.66 2.77 6.47 12.11 4.21 19.88" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m146.7 125.4c1.9-1.74 3.29-2.33 7.37-2.04 3.84 0.3 6.35 2.3 6.35 4.31 0 1.49-0.39 3.4-0.05 4.47 0.34 0.92 2.14 0.15 4.83 1.74 5.38 3.08 6.01 7.88 5.43 13.7s-3.91 8.56-7.34 8.41" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m165.6 121c2.65-2.21 3.77-4.94 3.57-10.42 0.92 0 1.55 0.82 1.4 2.41-0.14 1.59-0.29 2.92 0.49 3.6 1.12 0.92 4.71 0.82 7.16 2.41 2.11 1.33 2.84 4.87 2.45 6.09" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m171.2 127.6c2.06-0.58 3.71 0.59 5.76 0.79 3.03 0.29 6.01 3.99 6.73 8.11" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m124.5 114.8c3.84 2.31 5.23 8.08 4.84 14.89-0.15 2.46-2.21 2.75-2.31 4.19-0.19 2.26 1.03 2.69 1.85 4.18 0.68 1.22 0.88 3.63 0.88 4.7" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m119.1 129.7c1.38-1.32 6.51-1.61 9.02 0.19" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m104.4 93.76c-0.49 5.18 1.21 8.87 6.4 9.94 1.07 0.24 0.87 1.41-0.4 2.79-2.78 3.13-4.33 9.89-1.72 12.45" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m116.9 122.2c-0.82-1.9-2.72-2.19-5.46-2.53-7.56-1.02-11.3 0.73-14.79 6.45-1.9 3.28-1.56 7.98 3 9.99 1.59 0.73 1.06 1.7-0.27 3.39-1.8 2.46-2.38 6.53 3.63 9.19" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m85.02 133.4c1.39-3.18 3.69-4.25 9.85-4.15" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m89.83 128.4c1.18-4.37-0.88-12.37-7.29-11.98-2.55 0.15-4.46 2.65-5.84 1.88" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m43.22 102.6c4.27-1.9 5.86-2.62 8.07-1.9" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m27.81 118.1c1.7-3.9 4.72-6.1 11.24-5.08 2.88 0.49 5.09 2.99 5.09 6.17 0 1.33-0.2 2.2-2.1 5.9 1.7 0 3.03-2.51 6.01-3.09 0.87-0.19 1.16-0.24 1.7-0.49" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m40.12 107c0.92 0 1.26 1.07 1.07 3.08-0.2 2.01 0 2.88 0.87 3.8" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m10.12 118.3c-1.7-2.3-3.08-10.2-0.43-15.19" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m5.72 129.5c2.36-1.37 3.33-1.47 5.49-1.37 1.49 0.05 2.51-1.02 2.7-1.6 0.58-1.17 4.12-1.12 5.24 0.31 1.49 2.06 0.86 5.19 0.14 7.8" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m13.72 139.6c1.49-0.19 2.61 4.32 5.89 7.1" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m25.02 107.3c0.68-3.85 2.06-6.59 3.96-7.66 1.07-0.63 0.15-3.03-1.91-3.03" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m29.12 97.06c2.06-0.87 4.79-1.26 7.67-1.16" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m37.1 125.2c-1.49 5.33-3.79 9.99-2.36 15.51 0.87 3.49 2.36 6 3.48 7.59" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m41.23 138.2c1.49-1.22 2.71-2.19 5.27-2.04" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m50.19 149.4c-3.48-1.32-6.18-1.22-8.96 0" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m56.91 138.8c0.87-3.49 4.2-5.08 5.22-7.59 0.58-1.44-0.1-2.93 0.92-2.93 1.7 0 1.8 0.82 1.65 2.42-0.24 2.71 3.39 4.31 7.86 4.31 3.53 0 4.55-0.92 5.52-1.5 0.53-0.34 0.63-1.21 0.78-1.79-0.44 2.46-0.97 6.35 0 8.25 0.87 1.8 2.15 3.34 3.42 5.04" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m117.3 136.7c-2.35 3.48-4.26 11.34-9.89 13.9" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m50.04 127.2c-3.43 3.64-3.43 7.91-3.14 14.22" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m110 70.72c3.18-2.83 6.92-3.61 10.61-3.12 5.48 0.72 10.67 4.42 12.15 8.54 0.43 1.28 1.3 0.89 3.26 0.6" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m109 70.72c1.17 2.46 2.19 6.31 1.32 9.02-0.73 2.31 0.09 2.89 1.69 3.37 2.6 0.82 7.07 3.9 8.19 6.11 1.49 3.13 2.12 4.72 2.31 7.5" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m114.7 80.03c1.7-1.59 3.03-2.42 5.04-2.22" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m83.5 83.41c2.41-3.75 7.59-5.8 12.59-6.19 2.98-0.24 6.52 2.49 8.82 6.48" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m91.06 93.81c0.24-3.39 2.05-5.39 6.46-6.98" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m71.07 92.02c3.33-1.59 5.98-1.83 9.16-1.4 8.5 1.12 15.86 6.4 18.12 14.8" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m74.05 77.03c2.06 0.58 3.86 1.7 4.59 3.61" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m92.08 70.14c-2.06 1.38-2.06 2.77 0 3.59 1.54 0.68 1.98 1.36 2.95 3.32" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m45.18 85.06 1.91 8.55-0.78 2.46 1.7 0.97 2.01 2.01 2.6 3.97 1.39 11.01-0.87 1.59 1.9 1.02 1.59 4.37 0.97 2.61 2.51 0.48 7.51-1.07 2.46-2.01 4.42-1.32 2.83-3.08 0.68-3.9-5.09-11.01-1.32-7.61-0.49-7.06 1.7-3.33-1.07-1.07-1.43 0.97-1.27 1.22-4.32 2.21-0.53 3.39 0.53 2.69 8.01-7.11 0.29-3.38-1.9-0.53-1.02-9.09 1.91-6.96 5.08-10.25 1.71-0.73 0.48-6.96 2.36-0.87-0.53-2.16-1.9-0.58-1.12 0.82 0.53 1.7-5.53 10.4-2.88 6.71 0.92-6.96 3.89-12.67-1.38-2.88-1.53 0.49 0.14 2.41-2.21 6.3-4.94 10.25-3.69-0.58-0.49-4.47 2.88-9-1.38-2.01-1.8 1.12-2.7-1.59-1.9 0.58-3.23-2.41-0.78 0.92 1.07 2.46 1.91 3.54 0.29 8.5 0.73 2.93-2.98-6.01-12.23-16.13 0.63-1.12 2.21 0.34 1.17 1.59 1.33-1.12 2.16 0.29 0.92 0.92 0.44 7.11-2.65-6.91-1.38-1.12-2.01 0.29-2.21-0.15-1.59 0.87-1.7 4.12-1.07-1.91-1.02 0.97-3.89-1.75-1.12 1.65-0.97-2.06-2.21 1.38-3.79-3.39-2.98-1.22-0.34 2.21 1.28 0.63 2.11-0.63 0.97 1.38" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m46.14 13.07 2.06-1.43 1.85 0.19 3.74-1.12 0.92-1.02 1.6 0.31 1.17-0.49 0.82 0.92" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m34.2 13.12 1.91-0.63 1.7 0.14 1.27-2.63 1.02 0.44 1.91-0.29 1.9 0.44 0.87 0.43" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m60.41 9.69 1.27-0.49 1.02 0.8 1.22-0.68 1.33 1.02 0.87-0.73 1.02 1.17" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m68.11 12.34 2.74 0.29 1.33 1.59 0.87-0.14 1.43 2.45" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m76.7 18.4 1.33-0.68 1.07 1.02-0.39 1.28 2.31 2.6-0.39 1.28 1.49 0.29 0.63 1.7 1.17-0.39 0.63 1.22 1.17-0.2" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m88.11 30.7 1.17-0.2 0.63 1.59 1.02 0.63 2.16 1.91 0.63 1.43-0.58 1.54 0.68 1.7-0.58 0.72 0.48 2.01-1.02 1.59-2.01-0.39-1.64 4.37" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m87.19 51.01 0.92 1.17 1.33 0.05 0.39 1.85-1.65 2.06-1.17 0.25-0.49-2.31-0.82 0.15" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m84.54 57.01-0.82 2.16-2.65 1.43-2.55 0.1-2.51 1.02-1.8 0.29" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m44.31 84.91-2.78-3.79-4.32 0.48-1.38 0.1-0.82-1.27" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m14.92 77.91-1.9 0.29-1.49-1.59" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m8.11 70.1-1.02 0.43-0.97 1.18 1.02 1.38 1.49-0.29 0.29 1.33 1.33-0.34 0.58 1.27 1.22-0.44 0.44 1.44 1.59-0.34 1.02 1.02 0.82-1.7 0.1-3.02 1.02-0.97-1.59-1.02 1.59-0.82" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m4.63 64.23-0.24-2.11 0.82-1.59-0.72-1.49 0.92-1.22-0.68-1.8 0.92-1.12-1.43-3.84 1.33-2.16 0.15-2.46 1.48-0.72 0.73-3.13 2.16-2.51 0.97-0.19 1.07-1.8 3.08-2.06 0.43-1.48 2.21-0.73" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m18.07 31.91-0.82-2.3 1.49-2.51 0.67-1.07 1.07-0.24-0.29-1.38 1.9-0.68 0.82-2.65 0.97 0.29 0.63-1.33 0.92-1.53 1.7-0.58 0.77-0.92 1.8-0.53 0.73-0.44 1.02 0.68" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m30.63 28.12 1.49-3.69 2.36-0.53 0.63 0.92" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m40.07 18.31 0.97-0.58 1.38-0.1" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m58.34 15.61 0.48 0.77 0.82-0.77 2.56 0.29 0.48 1.02" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m66.69 16.53 0.49 1.28" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m70.02 18.44 1.02 0.29 1.64 0.19 0.97 1.28-0.73 1.22" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m76.03 23.21 2.88-0.58 0.29-1.43" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m71.52 24.7 1.07 0.58 1.17-0.58 1.02 1.33" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m67.2 26.03-1.12 1.02-0.53 2.06" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m64.74 30.01-0.53 1.27 0.87 1.02-0.87 1.02 0.43 1.33-0.92 1.38" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m50.41 33.32 0.72-0.29 1.07 1.85 0.58 0.15" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m52.01 32.05-0.73 0.97" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m41.14 33.42-0.82-1.44 0.48-3.74 1.48-2.21 2.26-1.22" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m48.83 22.62 0.29-1.02 1.33-0.53 2.46 0.1 0.82-0.49 1.59 0.73 1.49-0.39 2.01 0.68 1.22 0.48 0.29 1.44" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m69.19 100.7-1.54 2.06-3.64 0.29c-2.3 0.63-3.9 4.01-3.46 6.89" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m68.22 103.5 1.22 1.59-0.43 6.31" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m56.91 101.8 2.51-1.43 1.59-3.28 7.16-6.01" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        <path d="m56.91 93.12 3.13 2.01-1.59 2.98" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m57.2 83.02-3.48 7.9 0.39 2.21" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m45.18 85.06-0.82-2.66 4.56-6.66-4.27-5.53 2.88 0.29 2.26 1.49 1.33 0.82 6.96 0.58 4.03 7.86-4.66-7.12-5.33-1.91-6.36-16.13-7.71-6.01-0.87-3.99" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m38.61 49.39 3.13 1.69 2.88 3.64 6.16 11.9" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m28.01 48.56 3.59 1.49 3.58-0.73 0.92 0.73" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m32.04 50.05 1.9 3.69 4.08 2.16 4.7 7.21" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m23.64 54.32 2.56 3.7 4.71 4.89 3.94 2.83" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m19.32 61.93 2.69-1.33-0.53-1.59 2.21-0.39 0.43-1.59 2.16 0.87 4.13 7.26 6.16 4.75 5.18 3.84 0.87 4.99" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m16.91 73.84 2.21-1.75 8.5 0.72 1.33 0.92 0.29 1.75 1.07 0.63 0.44 1.33 1.17-0.34" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m14.51 44.54 0.77-0.34 0.97 0.53 1.02-0.68 0.97 0.63 0.48 1.02" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m10.05 46.6 0.87-0.97-0.29-1.43 1.17-0.29" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m8.83 60.1 0.48-1.38 0.97-0.53" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m9.12 63.08 1.12 0.82 0.92-0.58" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m15.28 112.6c0.44 0.77 0 2.52 0.39 3.9 0.58 2.11 6.25 0.89 8.31 1.37" stroke="#FC7016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        <path d="m31.41 56.93c2.35 1.7 5.68 1.12 7.89 3.78 1.43 1.85 2.55 3.91 2.79 5.18" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m67.91 114.4-6.96 1.91-3.23 3.98" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m65.01 119.2 2.01-0.97 3.33-0.92 0.97-1.23-1.22-0.68" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m63.63 113.9 6.52-2.51 6.96 0.68" stroke="#1A6D59" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
