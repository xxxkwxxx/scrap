'use client'

import QRCode from 'react-qr-code'

interface Props {
    value: string
    size?: number
}

export default function QRCodeComponent({ value, size = 256 }: Props) {
    return (
        <div style={{ height: size, margin: "0 auto", maxWidth: size, width: "100%" }}>
            <QRCode
                size={256}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                value={value}
                viewBox={`0 0 256 256`}
            />
        </div>
    )
}
