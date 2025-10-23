import React from 'react'

// ver1.4.0 Mouse cursor icon component - extracted for use in multiple places
interface CursorIconProps {
  color: string
  width?: number
  height?: number
  maxHeight?: number
  onClick?: (e: React.MouseEvent) => void
  style?: React.CSSProperties
  className?: string
}

export const CursorIcon: React.FC<CursorIconProps> = ({
  color,
  width = 18,
  height = 30,
  onClick,
  style,
  className
}) => {

  return (
    <div
      style={{
        width: width,
        height: height,
        cursor: onClick ? 'pointer' : 'default',
        ...style
      }}
      className={className}
      onClick={onClick}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 100" width="100%" height="100%" style={{verticalAlign:'top'}}>
        <polygon
          points="32,100 53,92 36,57 60,56 0,0 0,81 16,65 32,100"
          stroke="black"
          fill={color}
          strokeWidth="6"
        />
      </svg>
    </div>
  )
}
