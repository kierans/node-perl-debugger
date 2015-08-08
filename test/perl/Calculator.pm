package Calculator;

use strict;
use Exporter;

our @ISA = qw/Exporter/;
our @EXPORT = qw/add/;

sub add {
  my $sum = 0;
  foreach my $operand (@_) {
    $sum += $operand;
  }

  return $sum;
}

1;