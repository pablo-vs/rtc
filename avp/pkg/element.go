package avp

// Element interface
type Element interface {
	Write(*Sample) error
	Attach(Element)
	Close()
	GetTs() uint32
	GetVersion() uint32
}
